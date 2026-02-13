const { 
    Client, 
    GatewayIntentBits, 
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
client.configGlobal = { ticketsEnabled: 1, bansEnabled: 1, configEnabled: 1 };

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

client.once('ready', async () => {
    console.log(`✅ Bot Online: ${client.user.tag}`);
    client.user.setActivity('Sistemas de Seguridad', { type: ActivityType.Watching });

    // --- LISTENER DE FIREBASE (STATUS ESPACIADO) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        client.configGlobal = data;

        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (statusChannel) {
            const getStatus = (v) => v === 1 ? "🟢 **OPERATIVO**" : (v === 2 ? "🟡 **MANTENIMIENTO**" : "🔴 **DESACTIVADO**");
            const embedColor = data.ticketsEnabled === 1 ? 0x00FF88 : (data.ticketsEnabled === 2 ? 0xFFCC00 : 0xFF3E3E);

            // Construcción del contenido con saltos de línea para el efecto de renglón vacío
            const statusDescription = [
                `🛰️ **SISTEMA DE TICKETS**\n${getStatus(data.ticketsEnabled)}`,
                `\n\u200B`, // Renglón vacío (caracter invisible)
                `🚫 **BANEOS GLOBALES**\n${getStatus(data.bansEnabled)}`,
                `\n\u200B`, // Renglón vacío (caracter invisible)
                `⚙️ **CONFIGURACIÓN**\n${getStatus(data.configEnabled)}`
            ].join('\n');

            const embed = new EmbedBuilder()
                .setTitle("🛰️ MONITOR DE SISTEMAS")
                .setDescription(statusDescription)
                .setColor(embedColor)
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: "Sincronización de Sistemas Activa", iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            // Lógica de Edición para evitar spam
            const messages = await statusChannel.messages.fetch({ limit: 10 });
            const lastStatusMsg = messages.filter(m => 
                m.author.id === client.user.id && 
                m.embeds[0]?.title === "🛰️ MONITOR DE SISTEMAS"
            ).first();

            if (lastStatusMsg) {
                await lastStatusMsg.edit({ 
                    content: `🔄 **Sistemas actualizados**`, 
                    embeds: [embed] 
                }).catch(() => null);
            } else {
                statusChannel.send({ 
                    content: `🔔 **Alerta de Sistemas:** <@&${ROL_STAFF_PING}>`, 
                    embeds: [embed] 
                });
            }
        }
    });

    // --- PANEL DE TICKETS ---
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMsgs = messages.filter(m => m.author.id === client.user.id);
        if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle("📩 Centro de Reportes")
            .setDescription("Presiona el botón para reportar un filtrador.")
            .setColor("Red");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ticket').setLabel('Reportar').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
        );

        await channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const cmd = client.commands.get(i.commandName);
        if (cmd) await cmd.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const status = client.configGlobal.ticketsEnabled;
        if (status === 0) return i.reply({ content: "❌ Sistema **Cerrado**.", ephemeral: true });
        if (status === 2) return i.reply({ content: "🟡 Sistema en **Mantenimiento**.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID del Usuario').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Pruebas (Link)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
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
        const emb = new EmbedBuilder().setTitle("Reporte Enviado").addFields({name:"User",value:u},{name:"Ev",value:e},{name:"Extra",value:o}).setColor("Blue").setTimestamp();
        await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [emb] });
        await i.reply({ content: `✅ Ticket: ${ch}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
