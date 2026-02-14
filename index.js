const { 
    Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, 
    PermissionFlagsBits, ActivityType, Collection, AttachmentBuilder 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('fs');

const client = new Client({ intents: [3276799] });
client.commands = new Collection();

// --- CONFIGURACIÓN DE CANALES ---
const CANAL_STATUS_WEB = '1471651769565315072';
const CANAL_TRANSCRIPTS = '1433599228479148082';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_REPORTES_WEB = '1412420238284423208';
const ROL_TICKETS = '1433603806003990560';

let statusMessageId = null; // Para editar en lugar de borrar

// Carga de comandos
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
    console.log(`✅ Sistema Blindado: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // --- MONITOR DE STATUS (EDICIÓN INTELIGENTE) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        client.configGlobal = data;

        const chan = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (!chan) return;

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

        const msgs = await chan.messages.fetch({ limit: 5 });
        const lastMsg = msgs.filter(m => m.author.id === client.user.id).first();

        if (lastMsg) {
            await lastMsg.edit({ embeds: [embedStatus], files: [logo] }).catch(() => null);
        } else {
            await chan.send({ embeds: [embedStatus], files: [logo] }).catch(() => null);
        }
    });

    // --- MONITOR DE REPORTES WEB (Para el canal 1412420238284423208) ---
    db.collection('WEB_REPORTS').onSnapshot(snap => {
        snap.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const chan = await client.channels.fetch(CANAL_REPORTES_WEB).catch(() => null);
                if (chan) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: "NUEVO REPORTE EXTERNO (WEB)", iconURL: 'attachment://logo.webp' })
                        .setColor("#00ff88")
                        .addFields(
                            { name: "👤 Usuario ID", value: `\`${data.infractorID}\``, inline: true },
                            { name: "📝 Detalles", value: data.comentario || "Sin descripción" }
                        )
                        .setImage(data.evidenciaLink) // Muestra la imagen si existe
                        .setTimestamp();
                    await chan.send({ embeds: [embed], files: [new AttachmentBuilder('./logo.webp')] });
                }
            }
        });
    });
});

client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i);
    }

    if (i.isButton()) {
        if (i.customId === 'close_ticket') {
            const logChan = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
            const msgs = await i.channel.messages.fetch();
            let txt = msgs.reverse().map(m => `[${m.author.tag}]: ${m.content}`).join('\n');
            if (logChan) await logChan.send({ content: `📂 Transcript: ${i.channel.name}`, files: [{ attachment: Buffer.from(txt), name: 'ticket.txt' }] });
            return i.channel.delete();
        }

        // Sistema de Tickets / Bugs
        const isBug = i.customId === 'btn_bug';
        const modal = new ModalBuilder().setCustomId(isBug ? 'mdl_bug' : 'mdl_reporte').setTitle(isBug ? 'Reportar Bug' : 'Reportar Filtración');
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Usuario / Título').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Descripción / Pruebas').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        await i.deferReply({ ephemeral: true });
        const isBug = i.customId === 'mdl_bug';
        const targetChanId = isBug ? CANAL_BUGS_ID : null;

        const ch = await i.guild.channels.create({
            name: `${isBug ? 'bug' : 'ticket'}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const logo = new AttachmentBuilder('./logo.webp');
        const embed = new EmbedBuilder()
            .setTitle(isBug ? "⚙️ REPORTE DE ERROR" : "🛡️ REPORTE DE FILTRACIÓN")
            .addFields(
                { name: "Enviado por:", value: `<@${i.user.id}>` },
                { name: "Información:", value: i.fields.getTextInputValue('u') },
                { name: "Detalles:", value: i.fields.getTextInputValue('e') }
            )
            .setThumbnail('attachment://logo.webp')
            .setColor(isBug ? "#ffcc00" : "#00d9ff");

        await ch.send({ content: `<@&${ROL_TICKETS}>`, embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar').setStyle(ButtonStyle.Danger))], files: [logo] });
        
        // Si es bug, mandar copia al canal de logs de bugs
        if (isBug) {
            const bugLog = await client.channels.fetch(CANAL_BUGS_ID).catch(() => null);
            if (bugLog) bugLog.send({ embeds: [embed], files: [new AttachmentBuilder('./logo.webp')] });
        }

        await i.editReply(`✅ Creado en ${ch}`);
    }
});

client.login(process.env.BOT_TOKEN);
