const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar server')
    .addChannelOption(o => o.setName('sanciones').setRequired(true).setDescription('Logs'))
    .addChannelOption(o => o.setName('avisos').setRequired(true).setDescription('Avisos'))
    .addStringOption(o => o.setName('modo').setRequired(true).addChoices({name:'AutoBan',value:'AutoBan'},{name:'AvisoStaff',value:'AvisoStaff'}))
    .addRoleOption(o => o.setName('rolstaff').setRequired(true).setDescription('Mencionar'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.client.configGlobal.configEnabled) return interaction.reply({ content: "❌ Comandos de configuración desactivados.", ephemeral: true });

    const config = {
      guildId: interaction.guild.id,
      canalSanciones: interaction.options.getChannel('sanciones').id,
      canalAvisos: interaction.options.getChannel('avisos').id,
      modo: interaction.options.getString('modo'),
      rolStaff: interaction.options.getRole('rolstaff').id
    };
    await db.collection('SERVIDORES').doc(interaction.guild.id).set(config);
    await interaction.reply({ content: "✅ Configuración guardada.", ephemeral: true });
  }
};
