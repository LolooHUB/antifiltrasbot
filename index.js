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

const ROL_TICKETS = '1433603806003990560';
const ROL_STAFF_PING = '1433602018957594717';
const CANAL_TICKETS_ID = '1433599187324502016';
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
    console.log(`✅ Bot Online: ${client.user.tag}`);
    client.user.setActivity('Sistemas de Seguridad', { type: ActivityType.Watching });

    // --- MONITOR DE SISTEMAS (EDICIÓN SILENCIOSA) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
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
            .setFooter({ text: "Sincronización en tiempo real con la base de datos" })
            .setTimestamp();

        const messages = await statusChannel.messages.fetch({ limit: 10 });
        const lastStatusMsg = messages.filter(m => m.author.id === client.user.id && m.embeds[0]?.author?.name === "SISTEMA DE SEGURIDAD ANTI-FILTRAS").first();

        if (lastStatusMsg) {
            await lastStatusMsg.edit({ content: null, embeds: [statusEmbed] }).catch(() => null);
        } else {
            await statusChannel.send({ embeds: [statusEmbed] });
        }

        if (data.forcePing && !isFirstLoad && data.forcePing !== lastPingTimestamp) {
            statusChannel.send({ content: `⚠️ **NOTIFICACIÓN:** Se han actualizado los sistemas. <@&${ROL_STAFF_PING}>` })
                .then(m => setTimeout(() => m.delete(), 60000));
            lastPingTimestamp = data.forcePing;
        }
        isFirstLoad = false;
    });

    // --- PANEL DE TICKETS ---
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 5 });
        const botMsgs = messages.filter(m => m.author.id === client.user.id);
        if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

        await channel.send({ 
            embeds: [new EmbedBuilder().setTitle("📩 Centro de Reportes").setDescription("Presiona el botón para abrir un ticket.").setColor(0x2b2d31)], 
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ticket').setLabel('Reportar').setStyle(ButtonStyle.Danger).setEmoji('🛡️'))] 
        });
    }
});

client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const cmd = client.commands.get(i.commandName);
        if (cmd) await cmd.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const s = client.configGlobal.ticketsEnabled;
        if (s === 0) return i.reply({ content: "❌ Cerrado.", ephemeral: true });
        if (s === 2) return i.reply({ content: "🟡 Mantenimiento.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID Usuario').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Pruebas (Link)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const u = i.fields.getTextInputValue('u'), e = i.fields.getTextInputValue('e'), o = i.fields.getTextInputValue('o') || 'N/A';
        const ch = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [new EmbedBuilder().setTitle("Nuevo Reporte").addFields({name:"User",value:u},{name:"Ev",value:e},{name:"Extra",value:o}).setColor(0x2b2d31)] });
        await i.reply({ content: `✅ Ticket: ${ch}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
