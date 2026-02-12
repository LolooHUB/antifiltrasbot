const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();
const ROL_TICKETS = '1433602012163080293';
const CANAL_TICKETS_ID = 'ID_DE_TU_CANAL_TICKETS'; // <--- COLOCA AQUÍ EL ID DEL CANAL

// Carga de Comandos
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
}

client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);

    // LÓGICA DEL PANEL AUTO-LIMPIABLE
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        // Buscar y borrar mensajes previos del bot para no spamear
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        if (botMessages.size > 0) await channel.bulkDelete(botMessages).catch(() => null);

        // Enviar nuevo panel
        const embed = new EmbedBuilder()
            .setTitle("📩 Centro de Reportes")
            .setDescription("Haz clic en el botón de abajo para reportar a un usuario o filtrador.\n\n**Recuerda tener evidencia preparada.**")
            .setColor("#ff0000");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_ticket')
                .setLabel('Abrir Reporte')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️')
        );

        await channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar Filtrador');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Usuario Reportado').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia (Texto)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Info Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const userRep = i.fields.getTextInputValue('u');
        const txtEv = i.fields.getTextInputValue('e');
        const extra = i.fields.getTextInputValue('o') || 'N/A';

        const ch = await i.guild.channels.create({
            name: `reporte-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("🛡️ Nuevo Ticket de Reporte")
            .addFields(
                { name: "👤 Reportado", value: userRep },
                { name: "📄 Evidencia", value: txtEv },
                { name: "➕ Extra", value: extra }
            )
            .setColor("Blue")
            .setFooter({ text: "Sube tus imágenes/videos en este canal." });

        await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [embed] });
        await i.reply({ content: `Ticket abierto: ${ch}`, ephemeral: true });
    }
});

if (!process.env.BOT_TOKEN) {
    console.error("ERROR: La variable BOT_TOKEN no está definida en el entorno.");
    process.exit(1);
}

client.login(process.env.BOT_TOKEN);
