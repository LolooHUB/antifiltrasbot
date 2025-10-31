import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("reportar")
    .setDescription("Crea un ticket para reportar a un usuario."),
  async execute(interaction) {
    const guild = interaction.guild;
    const category = guild.channels.cache.find(c => c.name === "Reportes" && c.type === 4);

    const ticket = await guild.channels.create({
      name: `reporte-${interaction.user.username}`,
      type: 0,
      parent: category ? category.id : null,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket de reporte creado")
      .setDescription(`Tu ticket ha sido creado: ${ticket}`)
      .setColor("Green");

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
