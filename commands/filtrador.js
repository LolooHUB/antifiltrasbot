const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Ejecutar un baneo global de un usuario filtrador')
    .addStringOption(o => o.setName('id').setDescription('ID de Discord del usuario a banear').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Razón del baneo global').setRequired(true))
    .addStringOption(o => o.setName('evidencia').setDescription('Enlace a la prueba (Imgur/Discord/etc)').setRequired(true)),

  async execute(interaction) {
    if (!interaction.client.configGlobal.bansEnabled) {
        return interaction.reply({ content: "❌ Los baneos globales están desactivados actualmente.", ephemeral: true });
    }

    const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
    if (!STAFF_ROLES.some(id => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: "❌ No tienes autorización (Rol de Staff Global) para usar esto.", ephemeral: true });
    }

    const id = interaction.options.getString('id');
    const mot = interaction.options.getString('motivo');
    const ev = interaction.options.getString('evidencia');

    await interaction.deferReply();

    // Guardar en Firebase (Para la Web y el Bot)
    await db.collection('BANEOS').doc(id).set({ 
        id, 
        motivo: mot, // Nombre corregido para coincidir con la web
        evidencia: ev, // Nombre corregido para coincidir con la web
        fecha: new Date() 
    });

    // Log Global
    const logGlobal = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
    if (logGlobal) {
        logGlobal.send(`🚨 **Global Ban Ejecutado**: <@${id}> (\`${id}\`)\n**Motivo:** ${mot}\n**Evidencia:** ${ev}`);
    }

    // Ejecución en todos los servidores configurados
    const servidores = await db.collection('SERVIDORES').get();
    
    for (const doc of servidores.docs) {
      const s = doc.data();
      const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
      if (!guild) continue;

      if (s.modo === 'AutoBan') {
        await guild.members.ban(id, { reason: `Filtra Global: ${mot}` }).catch(() => null);
        const log = await guild.channels.fetch(s.canalSanciones).catch(() => null);
        if (log) {
            const embed = new EmbedBuilder()
                .setTitle("🛡️ Sistema Anti-Filtras: BAN")
                .setDescription(`Se ha expulsado a un usuario marcado globalmente.`)
                .addFields(
                    { name: "Usuario", value: `<@${id}>`, inline: true },
                    { name: "Motivo", value: mot, inline: true },
                    { name: "Pruebas", value: `[Click aquí](${ev})` }
                )
                .setColor("Red")
                .setTimestamp();
            log.send({ embeds: [embed] });
        }
      } else {
        const avisos = await guild.channels.fetch(s.canalAvisos).catch(() => null);
        if (avisos) {
            avisos.send(`⚠️ <@&${s.rolStaff}> **Alerta de Filtrador**: El usuario <@${id}> ha ingresado o está en el servidor y tiene un baneo global activo.\n**Motivo:** ${mot}\n**Evidencia:** ${ev}`);
        }
      }
    }
    
    await interaction.editReply(`✅ El usuario \`${id}\` ha sido procesado globalmente.`);
  }
};
