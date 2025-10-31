import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banea globalmente a un usuario.")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a banear").setRequired(true))
    .addStringOption(opt => opt.setName("razon").setDescription("Motivo del baneo").setRequired(true)),
  async execute(interaction, { GLOBAL_BANS_CHANNEL_ID, LOGS_CHANNEL_ID }) {
    const user = interaction.options.getUser("usuario");
    const reason = interaction.options.getString("razon");

    const banEmbed = new EmbedBuilder()
      .setTitle("🚫 Baneo Global")
      .setColor("Red")
      .addFields(
        { name: "Usuario", value: `${user.tag}`, inline: true },
        { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
        { name: "Razón", value: reason }
      )
      .setTimestamp();

    const bansChannel = interaction.client.channels.cache.get(GLOBAL_BANS_CHANNEL_ID);
    const logsChannel = interaction.client.channels.cache.get(LOGS_CHANNEL_ID);

    if (bansChannel) bansChannel.send({ embeds: [banEmbed] });
    if (logsChannel) logsChannel.send({ embeds: [banEmbed] });

    await interaction.reply({ content: `✅ ${user.tag} ha sido baneado globalmente.`, ephemeral: true });
  },
};
