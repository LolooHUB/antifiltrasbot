const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura el bot para este servidor')
    .addChannelOption(opt => opt.setName('sanciones').setDescription('Canal de sanciones').setRequired(true))
    .addChannelOption(opt => opt.setName('avisos').setDescription('Canal de avisos').setRequired(true))
    .addStringOption(opt => opt.setName('modo').setDescription('Modo de operación').setRequired(true)
      .addChoices({ name: 'AutoBan', value: 'autoban' }, { name: 'AvisoStaff', value: 'avisostaff' }))
    .addRoleOption(opt => opt.setName('rolstaff').setDescription('Rol de Staff local').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = {
      guildId: interaction.guild.id,
      canalSanciones: interaction.options.getChannel('sanciones').id,
      canalAvisos: interaction.options.getChannel('avisos').id,
      modo: interaction.options.getString('modo'),
      rolStaff: interaction.options.getRole('rolstaff').id
    };

    await db.collection('configs').doc(interaction.guild.id).set(config);
    await interaction.reply("Configuración guardada correctamente.");
  }
};
