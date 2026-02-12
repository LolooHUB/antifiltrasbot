const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

const STAFF_AUTORIZADOS = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Marca a un usuario como filtrador global')
    .addStringOption(opt => opt.setName('id').setDescription('ID del usuario').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(true))
    .addStringOption(opt => opt.setName('evidencia').setDescription('Link de evidencia').setRequired(true)),

  async execute(interaction) {
    if (!STAFF_AUTORIZADOS.some(id => interaction.member.roles.cache.has(id))) {
      return interaction.reply("No tienes permisos para marcar filtradores.");
    }

    const userId = interaction.options.getString('id');
    const motivo = interaction.options.getString('motivo');
    const evidencia = interaction.options.getString('evidencia');

    // Registrar en Firebase
    await db.collection('filtradores').doc(userId).set({
      userId, motivo, evidencia, fecha: new Date()
    });

    // Avisar en Canal Global de Sanciones
    const globalLog = await interaction.client.channels.fetch('1412415386971799693');
    globalLog.send(`🚨 **Nuevo Filtrador Detectado**: <@${userId}> (ID: ${userId}) - Motivo: ${motivo}`);

    // Ejecutar acciones en todos los servidores configurados
    const configsSnapshot = await db.collection('configs').get();
    
    configsSnapshot.forEach(async doc => {
      const config = doc.data();
      const guild = interaction.client.guilds.cache.get(config.guildId);
      if (!guild) return;

      const canalAviso = guild.channels.cache.get(config.canalAvisos);
      const canalSanciones = guild.channels.cache.get(config.canalSanciones);

      if (config.modo === 'autoban') {
        try {
          await guild.members.ban(userId, { reason: `Filtrador: ${motivo}` });
          if (canalSanciones) {
            const embed = new EmbedBuilder()
              .setTitle("Usuario Baneado por Filtrador")
              .setDescription(`El usuario <@${userId}> ha sido expulsado permanentemente.`)
              .addFields({ name: "Evidencia", value: evidencia })
              .setColor(0xFF0000);
            canalSanciones.send({ embeds: [embed] });
          }
          if (canalAviso) canalAviso.send(`El filtra <@${userId}> ha sido baneado del server. ¡Otro menos!`);
        } catch (e) { console.error(`Error baneando en ${guild.id}`); }
      } else {
        if (canalAviso) canalAviso.send(`<@&${config.rolStaff}> ⚠️ El usuario <@${userId}> ha sido marcado como filtra. Revisar evidencia: ${evidencia}`);
      }
    });

    await interaction.reply(`Usuario ${userId} procesado globalmente.`);
  }
};
