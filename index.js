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

// Configuración inicial por defecto
client.configGlobal = { ticketsEnabled: 1, bansEnabled: 1, configEnabled: 1 };

const ROL_TICKETS = '1433603806003990560';
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
    
    // Status de Actividad
    client.user.setActivity('Viendo reportes 🕵️', { type: ActivityType.Watching });

    // --- LISTENER DE FIREBASE (WEB CONTROL) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        
        // Actualizamos la config global del bot
        client.configGlobal = data;

        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (statusChannel) {
            const getStatusText = (v) => v === 1 ? "🟢 NORMAL" : (v === 2 ? "🟡 MANTENIMIENTO" : "🔴 CERRADO");
            const getEmbedColor = (v) => v === 1 ? "Green" : (v === 2 ? "Yellow" : "Red");

            const embed = new EmbedBuilder()
                .setTitle("🛠️ ACTUALIZACIÓN DESDE PANEL WEB")
                .setDescription("Se han detectado cambios en el estado de los servicios.")
                .addFields(
                    { name: "Tickets", value: getStatusText(data.ticketsEnabled), inline: true },
                    { name: "Baneos", value: getStatusText(data.bansEnabled), inline: true },
                    { name: "Config Servers", value: getStatusText(data.configEnabled), inline: true }
                )
                .setColor(getEmbedColor(data.ticketsEnabled))
                .setTimestamp()
                .setFooter({ text: "Anti-Filtras Status System" });

            statusChannel.send({ embeds: [embed] });
        }
    });

    // --- PANEL DE TICKETS (AUTO-LIMPIEZA Y ENVÍO) ---
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        // Borrar mensajes anteriores del bot para no duplicar panel
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMsgs = messages.filter(m => m.author.id === client.user.id);
        if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle("📩 Centro de Reportes")
            .setDescription("Si has detectado a un filtra o tienes pruebas de uno, presiona el botón de abajo para abrir un ticket de reporte.")
            .setColor("Red")
            .setFooter({ text: "Anti-Filtras Community" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_ticket')
                .setLabel('Reportar Filtrador')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async i => {
    // Manejo de Slash Commands
    if (i.isChatInputCommand()) {
        const cmd = client.commands.get(i.commandName);
        if (cmd) await cmd.execute(i);
    }

    // Manejo del Botón de Ticket
    if (i.isButton() && i.customId === 'btn_ticket') {
        const status = client.configGlobal.ticketsEnabled;

        if (status === 0) {
            return i.reply({ content: "❌ El sistema de tickets está actualmente **Cerrado**.", ephemeral: true });
        }
        if (status === 2) {
            return i.reply({ content: "🟡 El sistema está en **Mantenimiento**. Por favor, intenta más tarde.", ephemeral: true });
        }
        
        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Formulario de Reporte');
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('u').setLabel('Usuario (ID o Tag)').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 123456789...').setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('e').setLabel('Evidencia (Links)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Links de Imgur, Discord, etc.').setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('o').setLabel('Información Extra').setStyle(TextInputStyle.Paragraph).setRequired(false)
            )
        );
        
        await i.showModal(modal);
    }

    // Manejo del Envío del Modal
    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const u = i.fields.getTextInputValue('u');
        const e = i.fields.getTextInputValue('e');
        const o = i.fields.getTextInputValue('o') || 'N/A';

        // Crear el canal del ticket
        const ch = await i.guild.channels.create({
            name: `🎫-reporte-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const emb = new EmbedBuilder()
            .setTitle("🆕 NUEVO REPORTE RECIBIDO")
            .addFields(
                { name: "👤 Usuario Reportado", value: `\`${u}\`` },
                { name: "📸 Evidencias", value: e },
                { name: "📝 Detalles", value: o },
                { name: "📂 Enviado por", value: `${i.user.tag} (${i.user.id})` }
            )
            .setColor("Blue")
            .setTimestamp();

        await ch.send({ content: `<@${i.user.id}> | <@&${ROL_TICKETS}>`, embeds: [emb] });
        await i.reply({ content: `✅ Ticket creado correctamente: ${ch}`, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
