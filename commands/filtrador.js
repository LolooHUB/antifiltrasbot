const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Marca y banea a un filtrador de forma global')
    .addStringOption(o => o.setName('id').setDescription('ID del usuario').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Razón del baneo').setRequired(true))
    .addStringOption(o => o.setName('evidencia').setDescription('Link de imagen/video (EVIDENCIA MULTIMEDIA)').setRequired(true)),

  async execute(interaction) {
    const STAFF_IDS = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
    if (!STAFF_IDS.some(id => interaction.member.roles.cache.has(id))) {
      return interaction.reply({ content: "❌ No tienes autorización para ejecutar baneos globales.", ephemeral: true });
    }

    const userId = interaction.options.getString('id');
    const motivo = interaction.options.getString('motivo');
    const evidencia = interaction.options.getString('evidencia'); // Aquí va el link de la imagen/video

    await interaction.deferReply(); // Para evitar que el comando expire si hay muchos servidores

    // 1. Guardar en Colección BANEOS
    await db.collection('BANEOS').doc(userId).set({ userId, motivo, evidencia, fecha: new Date(), admin: interaction.user.tag });

    // 2. Embed Estilizado para el Canal Global (Main Server)
    const globalEmbed = new EmbedBuilder()
      .setTitle("🚨 NUEVO FILTRADOR REGISTRADO")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setColor("#ff0000")
      .addFields(
        { name: "👤 Usuario Marcado", value: `<@${userId}> (ID: ${userId})`, inline: false },
        { name: "⚖️ Motivo de Sanción", value: motivo, inline: false },
        { name: "👮 Admin Responsable", value: interaction.user.tag, inline: true }
      )
      .setImage(evidencia) // Muestra la imagen directamente en el embed
      .setFooter({ text: "Sistema Anti-Filtras Global" })
      .setTimestamp();

    const globalLog = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
    if (globalLog) globalLog.send({ embeds: [globalEmbed] });

    // 3. LOGICA MULTI-SERVIDOR (Recorrer SERVIDORES)
    const snapshot = await db.collection('SERVIDORES').get();
    
    let servidoresAfectados = 0;

    for (const doc of snapshot.docs) {
      const config = doc.data();
      const guild = interaction.client.guilds.cache.get(config.guildId);
      
      if (!guild) continue;

      const canalSanciones = guild.channels.cache.get(config.canalSanciones);
      const canalAvisos = guild.channels.cache.get(config.canalAvisos);

      if (config.modo === 'AutoBan') {
        try {
          await guild.members.ban(userId, { reason: `FILTRADOR GLOBAL: ${motivo}` });
          
          if (canalSanciones) {
            const bEmbed = new EmbedBuilder()
              .setTitle("🚫 USUARIO BANEADO AUTOMÁTICAMENTE")
              .setDescription(`Se ha detectado a un filtrador global en el servidor.`)
              .setColor("#990000")
              .addFields(
                { name: "👤 Usuario", value: `<@${userId}>`, inline: true },
                { name: "📝 Razón", value: "Usuario marcado como Filtrador", inline: true }
              )
              .setImage(evidencia)
              .setFooter({ text: "Seguridad Anti-Filtras" });
            
            await canalSanciones.send({ embeds: [bEmbed] });
          }

          if (canalAvisos) {
            await canalAvisos.send(`El filtra <@${userId}> ha sido baneado del server. ¡Otro menos!`);
          }
          servidoresAfectados++;
        } catch (e) {
          console.error(`Error baneando en ${guild.name}:`, e.message);
        }
      } else {
        // MODO AVISO STAFF
        if (canalAvisos) {
          const aEmbed = new EmbedBuilder()
            .setTitle("⚠️ ALERTA DE FILTRADOR")
            .setDescription(`Un usuario marcado globalmente ha sido detectado.`)
            .setColor("#f1c40f")
            .addFields({ name: "Usuario", value: `<@${userId}>` }, { name: "Motivo", value: motivo })
            .setImage(evidencia);

          await canalAvisos.send({ content: `<@&${config.rolStaff}>`, embeds: [aEmbed] });
          servidoresAfectados++;
        }
      }
    }

    await interaction.editReply(`✅ Usuario <@${userId}> marcado. Acciones ejecutadas en **${servidoresAfectados}** servidores.`);
  }
};
