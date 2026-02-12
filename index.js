const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('./firebase');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// IDs CONFIGURADOS
const ROLES_STAFF_AUTORIZADOS = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
const CANAL_GLOBAL_LOG = '1412415386971799693';
const ROL_TICKETS = '1433602012163080293';

client.on('interactionCreate', async (interaction) => {
  // 1. ABRIR MODAL
  if (interaction.isButton() && interaction.customId === 'abrir_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('modal_reporte')
      .setTitle('Reporte de Usuario / Filtra');

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel("Usuario Reportado").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('evidencia').setLabel("Evidencia (Texto)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opcional').setLabel("Algo más (Opcional)").setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    return interaction.showModal(modal);
  }

  // 2. PROCESAR MODAL
  if (interaction.isModalSubmit() && interaction.customId === 'modal_reporte') {
    const target = interaction.fields.getTextInputValue('target');
    const evidencia = interaction.fields.getTextInputValue('evidencia');
    const opcional = interaction.fields.getTextInputValue('opcional') || "Ninguna";

    const channel = await interaction.guild.channels.create({
      name: `reporte-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Nuevo Reporte Recibido")
      .setColor(0x2b2d31)
      .addFields(
        { name: "👤 Reportado", value: target, inline: true },
        { name: "📝 Evidencia Texto", value: evidencia },
        { name: "➕ Info Opcional", value: opcional }
      )
      .setFooter({ text: "Sube imágenes o vídeos ahora para completar el reporte." });

    await channel.send({ content: `<@${interaction.user.id}> <@&${ROL_TICKETS}>`, embeds: [embed] });
    await interaction.reply({ content: `Ticket creado: ${channel}`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
