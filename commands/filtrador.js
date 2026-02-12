const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Baneo Global con Archivo Multimedia')
    .addStringOption(o => o.setName('id').setDescription('ID del Filtrador').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Razón del baneo').setRequired(true))
    .addAttachmentOption(o => o.setName('archivo').setDescription('Sube la foto o video de evidencia').setRequired(true)),

  async execute(interaction) {
    const STAFF = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
    if (!STAFF.some(id => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: "No tienes permiso.", ephemeral: true });
    }

    const id = interaction.options.getString('id');
    const motivo = interaction.options.getString('motivo');
    const attachment = interaction.options.getAttachment('archivo'); // Captura el archivo
    const urlEvidencia = attachment.url; // URL generada por Discord

    await interaction.deferReply();

    // 1. Registro en Firebase
    await db.collection('BANEOS').doc(id).set({ id, motivo, evidencia: urlEvidencia, date: new Date() });

    // 2. Embed Estilizado (Global)
    const gEmb = new EmbedBuilder()
        .setTitle("🚨 FILTRADOR BANEADO GLOBALMENTE")
        .setColor("#ff0000")
        .addFields(
            { name: "👤 Usuario", value: `<@${id}> (ID: ${id})`, inline: true },
            { name: "⚖️ Motivo", value: motivo }
        )
        .setImage(urlEvidencia) // Muestra el archivo subido
        .setTimestamp();

    const globalLog = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
    if (globalLog) globalLog.send({ embeds: [gEmb] });

    // 3. Ejecución Multi-Servidor
    const snapshot = await db.collection('SERVIDORES').get();
    for (const doc of snapshot.docs) {
        const s = doc.data();
        const guild = interaction.client.guilds.cache.get(s.guildId);
        if (!guild) continue;

        if (s.modo === 'AutoBan') {
            try {
                await guild.members.ban(id, { reason: `Global Ban: ${motivo}` });
                const cSan = guild.channels.cache.get(s.canalSanciones);
                if (cSan) {
                    const bEmb = new EmbedBuilder()
                        .setTitle("🚫 ACCIÓN AUTOMÁTICA")
                        .setColor("#990000")
                        .addFields({ name: "Usuario", value: `<@${id}>` })
                        .setImage(urlEvidencia);
                    cSan.send({ embeds: [bEmb] });
                }
            } catch (e) { console.log(`Error en ${guild.name}`); }
        } else {
            const cAvi = guild.channels.cache.get(s.canalAvisos);
            if (cAvi) {
                const aEmb = new EmbedBuilder().setTitle("⚠️ ALERTA").setImage(urlEvidencia).setColor("#f1c40f");
                cAvi.send({ content: `<@&${s.rolStaff}> Detectado: <@${id}>`, embeds: [aEmb] });
            }
        }
    }

    await interaction.editReply(`✅ Usuario ${id} procesado con éxito.`);
  }
};
