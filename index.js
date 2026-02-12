const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('./firebase');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// IDs Globales del Servidor Main
const MAIN_GUILD_ID = 'TU_ID_SERVER_MAIN';
const LOGS_BOT = '1433599445114814555';
const REPORTES_LOG_BOT = '1433600237024448642';
const GLOBAL_BAN_LOG = '1412415386971799693';
const ROL_TICKETS_ID = '1433602012163080293';

client.on('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  // Aquí podrías enviar el mensaje inicial del ticket si no existe
});

client.on('interactionCreate', async interaction => {
  // Manejo de Botón para abrir Modal
  if (interaction.isButton() && interaction.customId === 'create_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Reportar Usuario / Filtra');

    const userReported = new TextInputBuilder()
      .setCustomId('user_reported')
      .setLabel("Usuario Reportado (Nombre o ID)")
      .setStyle(TextInputStyle.Short).setRequired(true);

    const evidenceText = new TextInputBuilder()
      .setCustomId('evidence_text')
      .setLabel("Evidencia en formato texto")
      .setStyle(TextInputStyle.Paragraph).setRequired(true);

    const extraInfo = new TextInputBuilder()
      .setCustomId('extra_info')
      .setLabel("Información adicional")
      .setStyle(TextInputStyle.Paragraph).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(userReported), 
                        new ActionRowBuilder().addComponents(evidenceText),
                        new ActionRowBuilder().addComponents(extraInfo));
    
    await interaction.showModal(modal);
  }

  // Manejo de Envío de Modal
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    const userReported = interaction.fields.getTextInputValue('user_reported');
    const evidenceText = interaction.fields.getTextInputValue('evidence_text');
    const extra = interaction.fields.getTextInputValue('extra_info') || 'N/A';

    const channel = await interaction.guild.channels.create({
      name: `reporte-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: ROL_TICKETS_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });

    await channel.send(`<@${interaction.user.id}> <@&${ROL_TICKETS_ID}>`);
    
    const embed = new EmbedBuilder()
      .setTitle("Nuevo Reporte de Filtra")
      .addFields(
        { name: "Reportado", value: userReported, inline: true },
        { name: "Reportante", value: interaction.user.tag, inline: true },
        { name: "Evidencia Texto", value: evidenceText },
        { name: "Extra", value: extra }
      )
      .setColor(0xFF0000)
      .setFooter({ text: "Por favor, adjunta imágenes/videos como evidencia adicional aquí." });

    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Ticket creado en ${channel}`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
