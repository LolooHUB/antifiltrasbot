const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtra-ban')
        .setDescription('🚫 Baneo global y registro de filtrador')
        .addStringOption(o => o.setName('usuario').setDescription('Nombre del infractor').setRequired(true))
        .addStringOption(o => o.setName('id').setDescription('ID de Discord').setRequired(true))
        .addStringOption(o => o.setName('motivo').setDescription('Razón del baneo').setRequired(true))
        .addAttachmentOption(o => o.setName('evidencia').setDescription('Sube la captura de prueba').setRequired(true)),

    async execute(interaction) {
        const CANAL_TRANSCRIPTS = '1433599228479148082';
        const logGlobal = await interaction.client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);

        if (interaction.client.configGlobal?.bansEnabled === 0) {
            return interaction.reply({ content: "❌ Los baneos globales están desactivados.", ephemeral: true });
        }

        const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF_ROLES.some(id => interaction.member.roles.cache.has(id))) {
            return interaction.reply({ content: "❌ No tienes rango Staff Global.", ephemeral: true });
        }

        const user = interaction.options.getString('usuario');
        const id = interaction.options.getString('id');
        const mot = interaction.options.getString('motivo');
        const file = interaction.options.getAttachment('evidencia');

        await interaction.deferReply();

        // Guardar en Firebase
        await db.collection('WEB_REPORTS').doc(id).set({ 
            infractorUser: user,
            infractorID: id, 
            comentario: mot, 
            evidenciaLink: file.url, // Guardamos la URL del archivo subido a Discord
            timestamp: new Date() 
        });

        const servidores = await db.collection('SERVIDORES').get();
        let bansExitosos = 0;
        let fallos = [];

        for (const doc of servidores.docs) {
            const s = doc.data();
            const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
            
            if (!guild) {
                fallos.push(`Servidor no encontrado o bot expulsado (ID: ${s.guildId})`);
                continue;
            }

            try {
                if (s.modo === 'AutoBan') {
                    await guild.members.ban(id, { reason: `Filtra Global: ${mot}` });
                    bansExitosos++;
                } else {
                    const avisos = await guild.channels.fetch(s.canalAvisos).catch(() => null);
                    if (avisos) avisos.send(`⚠️ **Alerta**: Filtrador **${user}** detectado.`);
                }
            } catch (err) {
                fallos.push(`Error en **${guild.name}**: ${err.message}`);
            }
        }

        // Reportar fallos en Transcripts
        if (fallos.length > 0 && logGlobal) {
            logGlobal.send({
                embeds: [new EmbedBuilder()
                    .setTitle("⚠️ Reporte de Errores en Propagación")
                    .setDescription(`Filtra: ${user} (\`${id}\`)\n\n${fallos.join('\n')}`)
                    .setColor("Orange")]
            });
        }

        await interaction.editReply(`✅ **${user}** procesado. Baneado en **${bansExitosos}** servidores.`);
    }
};
