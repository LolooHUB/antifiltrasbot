const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtra-ban')
        .setDescription('🚫 Baneo global y reporte con archivo adjunto')
        .addStringOption(o => o.setName('usuario').setDescription('Tag del infractor').setRequired(true))
        .addStringOption(o => o.setName('id').setDescription('ID de Discord').setRequired(true))
        .addStringOption(o => o.setName('motivo').setDescription('Razón del baneo').setRequired(true))
        .addAttachmentOption(o => o.setName('archivo').setDescription('Sube la prueba (.png/.jpg)').setRequired(true)),

    async execute(interaction) {
        const AVISO_MAIN = '1412415386971799693';
        const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        
        if (!STAFF_ROLES.some(roleId => interaction.member.roles.cache.has(roleId))) {
            return interaction.reply({ content: "❌ No eres Staff Global.", ephemeral: true });
        }

        const id = interaction.options.getString('id');
        const user = interaction.options.getString('usuario');
        const mot = interaction.options.getString('motivo');
        const file = interaction.options.getAttachment('archivo');

        await interaction.deferReply();

        // GUARDAR EN FIREBASE (Usamos la URL del attachment subido)
        await db.collection('WEB_REPORTS').doc(id).set({ 
            infractorUser: user, 
            infractorID: id, 
            comentario: mot, 
            evidenciaLink: file.url, // ESTO ES LO QUE EL INDEX LEERÁ
            timestamp: new Date() 
        });

        const logo = new AttachmentBuilder('./logo.webp');
        const embed = new EmbedBuilder()
            .setAuthor({ name: "🚨 BANEADO GLOBALMENTE", iconURL: 'attachment://logo.webp' })
            .setDescription(`**Filtra:** ${user} (\`${id}\`)\n**Motivo:** ${mot}`)
            .setImage(file.url)
            .setThumbnail('attachment://logo.webp')
            .setColor("#ff0000");

        // Aviso en el server Main
        const mainChan = await interaction.client.channels.fetch(AVISO_MAIN).catch(() => null);
        if (mainChan) await mainChan.send({ embeds: [embed], files: [logo] });

        // BANEO GLOBAL
        const servidores = await db.collection('SERVIDORES').get();
        for (const doc of servidores.docs) {
            const s = doc.data();
            const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
            if (guild && s.modo === 'AutoBan') {
                await guild.members.ban(id, { reason: `Filtra Global: ${mot}` }).catch(() => null);
            }
        }

        await interaction.editReply("✅ Baneo propagado con evidencia adjunta.");
    }
};
