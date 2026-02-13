const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar las opciones de seguridad del servidor')
    .addChannelOption(o => o.setName('sanciones').setDescription('Canal donde se enviarán los logs de baneo').setRequired(true))
    .addChannelOption(o => o.setName('avisos').setDescription('Canal donde se enviarán las alertas de filtradores').setRequired(true))
    .addStringOption(o => o.setName('modo')
        .setDescription('Elige si banear automáticamente o solo avisar') // ESTO FALTABA
        .setRequired(true)
        .addChoices(
            { name: 'AutoBan (Baneo automático)', value: 'AutoBan' },
            { name: 'AvisoStaff (Solo alertar)', value: 'AvisoStaff' }
        ))
    .addRoleOption(o => o.setName('rolstaff').setDescription('Rol que recibirá las menciones de alerta').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.client.configGlobal.configEnabled) {
        return interaction.reply({ content: "❌ Los comandos de configuración están desactivados por el Panel Web.", ephemeral: true });
    }

    const config = {
      guildId: interaction.guild.id,
      canalSanciones: interaction.options.getChannel('sanciones').id,
      canalAvisos: interaction.options.getChannel('avisos').id,
      modo: interaction.options.getString('modo'),
      rolStaff: interaction.options.getRole('rolstaff').id
    };

    await db.collection('SERVIDORES').doc(interaction.guild.id).set(config);
    await interaction.reply({ content: "✅ Configuración guardada correctamente para este servidor.", ephemeral: true });
  }
};
