const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Cargar Comandos
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

const ROL_TICKETS = '1433602012163080293';

client.on('interactionCreate', async (interaction) => {
  // Ejecución de Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Error ejecutando el comando.', ephemeral: true });
    }
  }

  // Lógica de Tickets (Botón)
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

  // Lógica de Modal
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
      .setTitle("🛡️ Nuevo Reporte")
      .setColor(0x2b2d31)
      .addFields(
        { name: "👤 Reportado", value: target, inline: true },
        { name: "📝 Evidencia Texto", value: evidencia },
        { name: "➕ Info Opcional", value: opcional }
      );

    await channel.send({ content: `<@${interaction.user.id}> <@&${ROL_TICKETS}>`, embeds: [embed] });
    await interaction.reply({ content: `Ticket creado en ${channel}`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
