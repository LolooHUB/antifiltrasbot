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

client.once('ready', async () => {
    console.log(`✅ Bot Online: ${client.user.tag}`);
    client.user.setActivity('Sistemas de Seguridad', { type: ActivityType.Watching });

    // --- LISTENER DE FIREBASE (EDICIÓN + PING MANUAL) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        client.configGlobal = data;

        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (!statusChannel) return;

        const getStatus = (v) => {
            if (v === 1) return "🟢 **`OPERATIVO`**";
            if (v === 2) return "🟡 **`MANTENIMIENTO`**";
            return "🔴 **`DESACTIVADO`**";
        };

        const embedColor = data.webEnabled === 1 ? 0x2b2d31 : (data.webEnabled === 2 ? 0xFFCC00 : 0xFF3E3E);

        const description = [
            "### Estado actual del bot y sus respectivos sistemas :\n",
            "🌐 **PÁGINA WEB :**",
            `${getStatus(data.webEnabled)}\n`,
            "📩 **TICKETS :**",
            `${getStatus(data.ticketsEnabled)}\n`,
            "⚙️ **CONFIGURACIÓN :**",
            `${getStatus(data.configEnabled)}\n`,
            "🚫 **BANEOS GLOBALES :**",
            `${getStatus(data.bansEnabled)}`
        ].join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: "ANTI-FILTRAS MONITOR", iconURL: client.user.displayAvatarURL() })
            .setDescription(description)
            .setColor(embedColor)
            .setFooter({ text: "Sincronización en tiempo real" })
            .setTimestamp();

        // 1. EDITAR SIEMPRE EL MENSAJE
        const messages = await statusChannel.messages.fetch({ limit: 10 });
        const lastStatusMsg = messages.filter(m => m.author.id === client.user.id && m.embeds[0]?.author?.name === "ANTI-FILTRAS MONITOR").first();

        if (lastStatusMsg) {
            await lastStatusMsg.edit({ content: null, embeds: [embed] }).catch(() => null);
        } else {
            await statusChannel.send({ embeds: [embed] });
        }

        // 2. PING MANUAL (Solo si se pulsa el botón en la web)
        if (data.forcePing && data.forcePing !== lastPingTimestamp) {
            if (lastPingTimestamp !== null) { 
                statusChannel.send({ 
                    content: `⚠️ **ATENCIÓN STAFF:** Se han actualizado los sistemas. <@&${ROL_STAFF_PING}>`,
                }).then(m => setTimeout(() => m.delete(), 60000));
            }
            lastPingTimestamp = data.forcePing;
        }
    });

    // --- PANEL DE TICKETS ---
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 5 });
        const botMsgs = messages.filter(m => m.author.id === client.user.id);
        if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ticket').setLabel('Reportar').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
        );

        await channel.send({ 
            embeds: [new EmbedBuilder().setTitle("📩 Centro de Reportes").setDescription("Presiona el botón para reportar.").setColor(0x2b2d31)], 
            components: [row] 
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
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const u = i.fields.getTextInputValue('u'), e = i.fields.getTextInputValue('e'), o = i.fields.getTextInputValue('o') || 'N/A';
        const ch = await i.guild.channels.create({
            name: `🎫-reporte-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [new EmbedBuilder().setTitle("Reporte").addFields({name:"User",value:u},{name:"Ev",value:e},{name:"Extra",value:o}).setColor("Blue")] });
        await i.reply({ content: `✅ Ticket: ${ch}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
