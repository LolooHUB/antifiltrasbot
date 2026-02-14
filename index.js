const { 
    Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, 
    PermissionFlagsBits, ActivityType, Collection, AttachmentBuilder 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('fs');

const client = new Client({ intents: [3276799] });
client.commands = new Collection();

// IDs CRÍTICAS
const CANAL_STATUS_WEB = '1471651769565315072';
const CANAL_TRANSCRIPTS = '1433599228479148082';
const ROL_TICKETS = '1433603806003990560';

// CARGA DE COMANDOS
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
    console.log(`✅ Anti-Filtras Pro activado como: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // Sincronización masiva de servidores en la DB
    client.guilds.cache.forEach(async (guild) => {
        await db.collection('SERVIDORES').doc(guild.id).set({ 
            guildId: guild.id, 
            serverName: guild.name 
        }, { merge: true });
    });

    // MONITOR DE STATUS (Blindado contra errores de borrado)
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        client.configGlobal = data;

        const chan = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (chan) {
            try {
                const msgs = await chan.messages.fetch({ limit: 15 });
                const myMsgs = msgs.filter(m => m.author.id === client.user.id);
                if (myMsgs.size > 0) await chan.bulkDelete(myMsgs, true).catch(() => null);
            } catch (e) { console.error("Error limpiando status"); }

            const logo = new AttachmentBuilder('./logo.webp');
            const op = "🟢 **OPERATIVO**";
            const off = "🔴 **DESACTIVADO**";

            const embedStatus = new EmbedBuilder()
                .setTitle("🛡️ SISTEMA DE SEGURIDAD ANTI-FILTRAS")
                .setDescription(`**Estado actual del bot y sus respectivos sistemas :**\n\n` +
                    `🌐 **PÁGINA WEB :**\n${data.webEnabled === 1 ? op : off}\n\n` +
                    `📩 **TICKETS :**\n${data.ticketsEnabled === 1 ? op : off}\n\n` +
                    `⚙️ **CONFIGURACIÓN :**\n${data.configEnabled === 1 ? op : off}\n\n` +
                    `🚫 **BANEOS GLOBALES :**\n${data.bansEnabled === 1 ? op : off}\n\n` +
                    `*Sincronización en tiempo real con la base de datos*`)
                .setThumbnail('attachment://logo.webp')
                .setColor("#2b2d31");

            await chan.send({ embeds: [embedStatus], files: [logo] }).catch(() => null);
        }
    });
});

// REGISTRO AL UNIRSE A NUEVOS SERVIDORES
client.on('guildCreate', async (guild) => {
    await db.collection('SERVIDORES').doc(guild.id).set({ 
        guildId: guild.id, 
        serverName: guild.name,
        joinedAt: new Date()
    }, { merge: true });
    
    const logs = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
    if (logs) logs.send(`📥 **Nuevo Servidor:** ${guild.name} (\`${guild.id}\`) - Miembros: ${guild.memberCount}`);
});

client.on('interactionCreate', async i => {
    // Manejo de Comandos
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i).catch(err => {
            console.error(err);
            i.reply({ content: "❌ Error interno al ejecutar el comando.", ephemeral: true });
        });
    }

    // Manejo de Botones (Tickets y Transcripts)
    if (i.isButton()) {
        if (i.customId === 'close_ticket') {
            await i.reply("🔒 Generando transcript y cerrando...");
            const logChan = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
            const msgs = await i.channel.messages.fetch();
            let content = `REGISTRO DE TICKET: ${i.channel.name}\nUSUARIO: ${i.user.tag}\n---\n`;
            msgs.reverse().forEach(m => {
                content += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
            });

            if (logChan) {
                await logChan.send({ 
                    content: `📂 **Transcript: ${i.channel.name}**`, 
                    files: [{ attachment: Buffer.from(content), name: `${i.channel.name}.txt` }] 
                });
            }
            setTimeout(() => i.channel.delete().catch(() => null), 3000);
            return;
        }

        // Abrir Modal de Reporte
        if (i.customId === 'btn_ticket') {
            if (client.configGlobal?.ticketsEnabled === 0) return i.reply({ content: "❌ El soporte está cerrado.", ephemeral: true });
            
            const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar Filtración');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Usuario o ID del Infractor').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia (Links)').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            await i.showModal(modal);
        }
    }

    // Manejo de Modales
    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        await i.deferReply({ ephemeral: true });
        const ch = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const logo = new AttachmentBuilder('./logo.webp');
        const welcome = new EmbedBuilder()
            .setAuthor({ name: "CENTRO DE SOPORTE", iconURL: 'attachment://logo.webp' })
            .setDescription(`Hola <@${i.user.id}>, gracias por reportar.\n\n**Usuario reportado:** ${i.fields.getTextInputValue('u')}\n**Pruebas:** ${i.fields.getTextInputValue('e')}\n\nUn <@&${ROL_TICKETS}> revisará esto pronto.`)
            .setColor("#2b2d31")
            .setThumbnail('attachment://logo.webp');

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger));

        await ch.send({ content: `<@${i.user.id}> | <@&${ROL_TICKETS}>`, embeds: [welcome], components: [row], files: [logo] });
        await i.editReply(`✅ Tu ticket ha sido creado en ${ch}`);
    }
});

client.login(process.env.BOT_TOKEN);
