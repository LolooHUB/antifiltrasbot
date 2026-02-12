const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Baneo Global con Archivo')
    .addStringOption(o => o.setName('id').setDescription('ID del Filtrador').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Razón').setRequired(true))
    .addAttachmentOption(o => o.setName('evidencia').setDescription('Sube la prueba (Imagen/Video)').setRequired(true)), // PERMITE SUBIR ARCHIVO

  async execute(interaction) {
    const STAFF = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
    if (!STAFF.some(id => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: "No autorizado.", ephemeral: true });
    }

    const id = interaction.options.getString('id');
    const motivo = interaction.options.getString('motivo');
    const attachment = interaction.options.getAttachment('evidencia');
    const urlEvidencia = attachment.url;

    await interaction.deferReply();

    // Guardar en Firebase
    await db.collection('BANEOS').doc(id).set({ id, motivo, evidencia: urlEvidencia, date: new Date() });

    // Canal Global
    const globalLog = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
    if (globalLog) {
        const gEmb = new EmbedBuilder()
            .setTitle("🚨 FILTRADOR BANEADO GLOBALMENTE")
            .setColor("#ff0000")
            .addFields({ name: "👤 Usuario", value: `<@${id}>` }, { name: "⚖️ Motivo", value: motivo })
            .setImage(urlEvidencia)
            .setTimestamp();
        await globalLog.send({ embeds: [gEmb] });
    }

    // Lógica Multi-Servidor corregida
    const snapshot = await db.collection('SERVIDORES').get();
    let contador = 0;

    // Usamos for...of para que el contador funcione bien con await
    for (const doc of snapshot.docs) {
        const s = doc.data();
        const guild = interaction.client.guilds.cache.get(s.guildId);
        if (!guild) continue;

        const cSan = guild.channels.cache.get(s.canalSanciones);
        const cAvi = guild.channels.cache.get(s.canalAvisos);

        if (s.modo === 'AutoBan') {
            try {
                await guild.members.ban(id, { reason: `Global Ban: ${motivo}` });
                if (cSan) {
                    const bEmb = new EmbedBuilder()
                        .setTitle("🚫 ACCIÓN AUTOMÁTICA")
                        .setColor("#990000")
                        .setImage(urlEvidencia)
                        .addFields({ name: "Usuario", value: `<@${id}>` });
                    await cSan.send({ embeds: [bEmb] });
                }
                contador++;
            } catch (e) { console.log(`Error en ${guild.name}`); }
        } else if (cAvi) {
            const aEmb = new EmbedBuilder().setTitle("⚠️ ALERTA").setImage(urlEvidencia).setColor("#f1c40f");
            await cAvi.send({ content: `<@&${s.rolStaff}> Detectado: <@${id}>`, embeds: [aEmb] });
            contador++;
        }
    }

    await interaction.editReply(`✅ Usuario ${id} procesado en **${contador}** servidores.`);
  }
};
