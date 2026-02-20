const { 
    Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, 
    PermissionFlagsBits, ActivityType, Collection, AttachmentBuilder, Events 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('fs');

const client = new Client({ intents: [3276799] });
client.commands = new Collection();

// IDs CONFIG
const CANAL_STATUS_WEB = '1471651769565315072';
const CANAL_TRANSCRIPTS = '1433599228479148082';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_REPORTES_WEB = '1412420238284423208';
const ROL_TICKETS = '1433603806003990560';

// Carga de comandos
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Evento corregido v15
client.once(Events.ClientReady, async () => {
    console.log(`✅ Anti-Filtras Pro: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // STATUS MONITOR (EDICIÓN)
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

        const msgs = await chan.messages.fetch({ limit: 10 }).catch(() => null);
        const lastMsg = msgs?.find(m => m.author.id === client.user.id);
        if (lastMsg) await lastMsg.edit({ embeds: [embedStatus], files: [logo] }).catch(() => null);
        else await chan.send({ embeds: [embedStatus], files: [logo] }).catch(() => null);
    });

    // MONITOR WEB_REPORTS (BLINDAJE TOTAL CONTRA CRASH)
    db.collection('WEB_REPORTS').onSnapshot(snap => {
        snap.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const chan = await client.channels.fetch(CANAL_REPORTES_WEB).catch(() => null);
                if (!chan) return;

                const logo = new AttachmentBuilder('./logo.webp');
                const embed = new EmbedBuilder()
                    .setAuthor({ name: "NUEVO REPORTE REGISTRADO", iconURL: 'attachment://logo.webp' })
                    .setColor("#ff0000")
                    .addFields(
                        { name: "👤 Usuario", value: `\`${data.infractorUser || 'N/A'}\``, inline: true },
                        { name: "🆔 ID", value: `\`${data.infractorID}\``, inline: true },
                        { name: "📝 Motivo", value: data.comentario || "Sin descripción" }
                    )
                    .setThumbnail('attachment://logo.webp')
                    .setTimestamp();

                // PROTECCIÓN: Solo pone imagen si es un link de Discord o URL real
                if (data.evidenciaLink && data.evidenciaLink.startsWith('http')) {
                    embed.setImage(data.evidenciaLink);
                }

                await chan.send({ embeds: [embed], files: [logo] }).catch(() => null);
            }
        });
    });
});

client.on(Events.InteractionCreate, async i => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i).catch(() => null);
    }

    if (i.isButton()) {
        if (i.customId === 'close_ticket') {
            const logChan = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
            const msgs = await i.channel.messages.fetch();
            let txt = msgs.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
            if (logChan) await logChan.send({ content: `📂 Transcript: ${i.channel.name}`, files: [{ attachment: Buffer.from(txt), name: `transcript-${i.channel.name}.txt` }] });
            return i.channel.delete().catch(() => null);
        }

        const isBug = i.customId === 'btn_bug';
        const modal = new ModalBuilder().setCustomId(isBug ? 'mdl_bug' : 'mdl_reporte').setTitle(isBug ? 'Reportar Error' : 'Reportar Filtrador');
        
        if (isBug) {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Descripción').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('user').setLabel('Nombre').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('id').setLabel('ID Discord').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Link de Evidencia').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        await i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        await i.deferReply({ ephemeral: true });
        const isBug = i.customId === 'mdl_bug';
        const ch = await i.guild.channels.create({
            name: `${isBug ? 'bug' : 'ticket'}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const logo = new AttachmentBuilder('./logo.webp');
        const embed = new EmbedBuilder()
            .setAuthor({ name: isBug ? "REPORTE TÉCNICO" : "REPORTE DE FILTRACIÓN", iconURL: 'attachment://logo.webp' })
            .setColor(isBug ? "#ffaa00" : "#ff0000").setThumbnail('attachment://logo.webp');

        if (isBug) {
            embed.addFields({ name: "📌 Título", value: i.fields.getTextInputValue('u') }, { name: "📝 Descripción", value: i.fields.getTextInputValue('e') });
            const bugLog = await client.channels.fetch(CANAL_BUGS_ID).catch(() => null);
            if (bugLog) bugLog.send({ embeds: [embed], files: [new AttachmentBuilder('./logo.webp')] });
        } else {
            embed.addFields(
                { name: "👤 Usuario", value: i.fields.getTextInputValue('user'), inline: true },
                { name: "🆔 ID", value: i.fields.getTextInputValue('id'), inline: true },
                { name: "📄 Evidencia", value: i.fields.getTextInputValue('e') }
            );
        }

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `<@&${ROL_TICKETS}>`, embeds: [embed], components: [row], files: [logo] });
        await i.editReply(`✅ Canal: ${ch}`);
    }
});

client.on(Events.MessageCreate, async (message) => {
    // Prefijo !
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'servers') {
        // BLINDAJE: Solo tú o los Staff Globales definidos antes pueden ver esto
        const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF_ROLES.some(id => message.member.roles.cache.has(id)) && message.author.id !== message.guild.ownerId) {
            return message.reply("❌ No tienes permisos para ver la red de servidores.");
        }

        const logo = new AttachmentBuilder('./logo.webp');
        const guilds = client.guilds.cache;
        
        // Mapear la lista de servidores
        const lista = guilds.map(g => `• **${g.name}** \`(${g.id})\` - 👥 ${g.memberCount}`).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: "RED DE SEGURIDAD ANTI-FILTRAS", iconURL: 'attachment://logo.webp' })
            .setTitle(`Conectado actualmente a ${guilds.size} servidores`)
            .setDescription(lista.length > 2048 ? lista.substring(0, 2045) + "..." : lista)
            .setThumbnail('attachment://logo.webp')
            .setColor("#2b2d31")
            .setFooter({ text: "Sistema de Monitoreo Global" })
            .setTimestamp();

        await message.reply({ embeds: [embed], files: [logo] });
    }
});

client.login(process.env.BOT_TOKEN);
