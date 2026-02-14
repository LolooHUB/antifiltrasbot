const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtra-ban')
        .setDescription('🚫 Registrar un nuevo filtrador en el sistema global')
        .addStringOption(o => o.setName('usuario').setDescription('Nombre/Tag del infractor').setRequired(true))
        .addStringOption(o => o.setName('id').setDescription('ID de Discord del infractor').setRequired(true))
        .addStringOption(o => o.setName('motivo').setDescription('Razón detallada de la sanción').setRequired(true))
        .addAttachmentOption(o => o.setName('evidencia').setDescription('Sube la prueba visual').setRequired(true)),

    async execute(interaction) {
        const CANAL_TRANSCRIPTS = '1433599228479148082';
        const logGlobal = await interaction.client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
        const logo = new AttachmentBuilder('./logo.webp'); // Usando tu archivo local

        if (interaction.client.configGlobal?.bansEnabled === 0) {
            return interaction.reply({ content: "❌ El sistema de baneos globales está desactivado temporalmente.", ephemeral: true });
        }

        const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF_ROLES.some(id => interaction.member.roles.cache.has(id))) {
            return interaction.reply({ content: "❌ Acceso denegado: Se requiere rol de Staff Global.", ephemeral: true });
        }

        const user = interaction.options.getString('usuario');
        const id = interaction.options.getString('id');
        const mot = interaction.options.getString('motivo');
        const file = interaction.options.getAttachment('evidencia');

        await interaction.deferReply();

        await db.collection('WEB_REPORTS').doc(id).set({ 
            infractorUser: user,
            infractorID: id, 
            comentario: mot, 
            evidenciaLink: file.url,
            adminResponsable: interaction.user.tag,
            timestamp: new Date() 
        });

        const embedBan = new EmbedBuilder()
            .setAuthor({ name: "🚨 NUEVO FILTRADOR REGISTRADO", iconURL: 'attachment://logo.webp' })
            .setDescription(`👤 **Usuario Marcado**\n<@${id}> (ID: ${id})\n\n⚖️ **Motivo de Sanción**\n${mot}\n\n👮 **Admin Responsable**\n${interaction.user.username}`)
            .setThumbnail('attachment://logo.webp')
            .setColor("#ff0000")
            .setFooter({ text: "Sistema Anti-Filtras Global" })
            .setTimestamp();

        const servidores = await db.collection('SERVIDORES').get();
        let conteo = 0;
        let errores = [];

        for (const doc of servidores.docs) {
            const s = doc.data();
            const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
            if (!guild) continue;

            try {
                if (s.modo === 'AutoBan') {
                    await guild.members.ban(id, { reason: `Filtra Global: ${mot}` });
                    conteo++;
                    const logLocal = await guild.channels.fetch(s.canalSanciones).catch(() => null);
                    if (logLocal) await logLocal.send({ embeds: [embedBan], files: [logo] });
                } else {
                    const avisos = await guild.channels.fetch(s.canalAvisos).catch(() => null);
                    if (avisos) await avisos.send({ content: `⚠️ **ALERTA DE FILTRADOR**`, embeds: [embedBan], files: [logo] });
                }
            } catch (err) {
                errores.push(`Fallo en **${guild.name}**: ${err.message}`);
            }
        }

        if (errores.length > 0 && logGlobal) {
            await logGlobal.send(`⚠️ **Reporte de fallos en baneo global (${user}):**\n\`\`\`${errores.join('\n')}\`\`\``);
        }

        await interaction.editReply({ content: `✅ **Registro Exitoso**. El usuario ha sido procesado en **${conteo}** servidores.`, embeds: [embedBan], files: [logo] });
    }
};
