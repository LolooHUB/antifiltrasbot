const { 
    Client, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ActivityType 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ intents: [3276799] });
client.commands = new Collection();
client.configGlobal = { webEnabled: 1, ticketsEnabled: 1, bansEnabled: 1, configEnabled: 1 };

// IDs de Configuración
const ROL_TICKETS = '1433603806003990560';
const ROL_STAFF_PING = '1433602018957594717';
const CANAL_TICKETS_ID = '1433599187324502016';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_STATUS_WEB = '1471651769565315072';

// Carga de Comandos
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
}

let lastPingTimestamp = null;
let isFirstLoad = true;

client.once('ready', async () => {
    console.log(`✅ Anti-Filtras Online: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // --- MONITOR DE SISTEMAS Y BLOQUEO DINÁMICO ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;

        // Lógica de Bloqueo de Tickets si el sistema se apaga
        if (data.ticketsEnabled === 0 && client.configGlobal.ticketsEnabled !== 0) {
            const guild = client.guilds.cache.first();
            const openTickets = guild.channels.cache.filter(c => c.name.startsWith('🎫-') || c.name.startsWith('🐛-'));
            openTickets.forEach(async (chan) => {
                await chan.permissionOverwrites.edit(ROL_TICKETS, { SendMessages: false });
                const pauseEmb = new EmbedBuilder()
                    .setTitle("⚠️ SISTEMA EN PAUSA")
                    .setDescription("> Nos encontramos realizando ajustes técnicos en ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ.\n\nEl chat ha sido **desactivado**. No podremos continuar con tu reporte hasta que el sistema vuelva a marcarse como `OPERATIVO` en el monitor principal.")
                    .setColor(0xff3e3e);
                await chan.send({ embeds: [pauseEmb] });
            });
        }

        client.configGlobal = data;
        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (!statusChannel) return;

        const getStatusStyle = (v) => {
            if (v === 1) return "🟢 **` OPERATIVO `**";
            if (v === 2) return "🟡 **` MANTENIMIENTO `**";
            return "🔴 **` DESACTIVADO `**";
        };

        const embedColor = data.webEnabled === 1 ? 0x2b2d31 : (data.webEnabled === 2 ? 0xFFCC00 : 0xFF3E3E);

        const statusEmbed = new EmbedBuilder()
            .setAuthor({ name: "SISTEMA DE SEGURIDAD ANTI-FILTRAS", iconURL: client.user.displayAvatarURL() })
            .setDescription(
                "### Estado actual del bot y sus respectivos sistemas :\n\n" +
                "🌐 **PÁGINA WEB :**\n" + `${getStatusStyle(data.webEnabled)}\n\n` +
                "📩 **TICKETS :**\n" + `${getStatusStyle(data.ticketsEnabled)}\n\n` +
                "⚙️ **CONFIGURACIÓN :**\n" + `${getStatusStyle(data.configEnabled)}\n\n` +
                "🚫 **BANEOS GLOBALES :**\n" + `${getStatusStyle(data.bansEnabled)}`
            )
            .setColor(embedColor)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ • Seguridad Global" })
            .setTimestamp();

        // Limpieza y Edición Silenciosa
        const messages = await statusChannel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        if (botMessages.size > 1) {
            await statusChannel.bulkDelete(botMessages).catch(() => null);
            await statusChannel.send({ embeds: [statusEmbed] });
        } else if (botMessages.size === 1) {
            await botMessages.first().edit({ content: null, embeds: [statusEmbed] }).catch(() => null);
        } else {
            await statusChannel.send({ embeds: [statusEmbed] });
        }

        // Ping Manual
        if (data.forcePing && !isFirstLoad && data.forcePing !== lastPingTimestamp) {
            statusChannel.send({ content: `⚠️ **NOTIFICACIÓN STAFF:** Actualización de sistemas manual. <@&${ROL_STAFF_PING}>` })
                .then(m => setTimeout(() => m.delete(), 30000));
            lastPingTimestamp = data.forcePing;
        }
        isFirstLoad = false;
    });

    // --- PANELES DE INICIO ---
    const setup = async (cid, t, d, bid, bl, em) => {
        const c = client.channels.cache.get(cid); if (!c) return;
        const ms = await c.messages.fetch({ limit: 5 });
        const bms = ms.filter(m => m.author.id === client.user.id);
        if (bms.size > 0) await c.bulkDelete(bms).catch(() => null);
        await c.send({ 
            embeds: [new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x2b2d31)],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(bid).setLabel(bl).setStyle(ButtonStyle.Secondary).setEmoji(em))]
        });
    };
    await setup(CANAL_TICKETS_ID, "🛡️ Reportar a un Filtra", "Si alguien está vendiendo o distribuyendo modelos sin permiso, repórtalo aquí.", "btn_ticket", "Reportar Usuario", "🛡️");
    await setup(CANAL_BUGS_ID, "🐛 Reportar un Error", "Si el bot o la web fallan, infórmalo a los desarrolladores.", "btn_bug", "Reportar Bug", "⚙️");
});

client.on('interactionCreate', async i => {
    if (i.isButton()) {
        if (i.customId === 'close_ticket') return i.channel.delete();
        
        const s = client.configGlobal.ticketsEnabled;
        if (s === 0) return i.reply({ content: "❌ El sistema de soporte está desactivado temporalmente.", ephemeral: true });

        if (i.customId === 'btn_ticket') {
            const m = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar Usuario');
            m.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID del Infractor').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia (Link)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Información Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
            await i.showModal(m);
        }

        if (i.customId === 'btn_bug') {
            const m = new ModalBuilder().setCustomId('mdl_bug').setTitle('Reportar Bug');
            m.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bt').setLabel('Sistema (Web/Bot)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bd').setLabel('Descripción del error').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bp').setLabel('Pasos para replicar').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
            await i.showModal(m);
        }
    }

    if (i.isModalSubmit()) {
        let title, fields = [], prefix, color = 0x2b2d31, thumb;

        if (i.customId === 'mdl_reporte') {
            prefix = '🎫-reporte'; title = '🛡️ SOLICITUD DE BANEO GLOBAL'; thumb = "https://i.imgur.com/vHq4MOn.png";
            fields = [
                { name: '### 👤 INFRACTOR', value: `> **ID:** \`${i.fields.getTextInputValue('u')}\`\n> **Motivo:** Venta/Distribución no autorizada`, inline: false },
                { name: '### 🔗 EVIDENCIA', value: i.fields.getTextInputValue('e'), inline: false },
                { name: '### 📝 DETALLES', value: `\`\`\`${i.fields.getTextInputValue('o') || 'Sin detalles.'}\`\`\``, inline: false },
                { name: '### ⚖️ POLÍTICA', value: "*Este reporte es analizado para reducir la cantidad de filtras globalmente.*", inline: false }
            ];
        } else if (i.customId === 'mdl_bug') {
            prefix = '🐛-bug'; title = '⚙️ REPORTE TÉCNICO'; color = 0xFFAA00; thumb = "https://i.imgur.com/8fO8z8f.png";
            fields = [
                { name: '### 💻 SISTEMA', value: `\`${i.fields.getTextInputValue('bt')}\``, inline: true },
                { name: '### 📖 DESCRIPCIÓN', value: i.fields.getTextInputValue('bd'), inline: false },
                { name: '### 🛠️ PASOS', value: `\`\`\`${i.fields.getTextInputValue('bp') || 'No indicados.'}\`\`\``, inline: false }
            ];
        }

        const ch = await i.guild.channels.create({
            name: `${prefix}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const reportEmb = new EmbedBuilder()
            .setAuthor({ name: `REMITENTE: ${i.user.tag}`, iconURL: i.user.displayAvatarURL() })
            .setTitle(title).addFields(fields).setColor(color).setThumbnail(thumb)
            .setFooter({ text: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ", iconURL: client.user.displayAvatarURL() }).setTimestamp();

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Caso').setStyle(ButtonStyle.Danger).setEmoji('🔒'));

        await ch.send({ content: `<@${i.user.id}> | <@&${ROL_TICKETS}>`, embeds: [reportEmb], components: [row] });
        await i.reply({ content: `✅ Caso abierto: ${ch}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
