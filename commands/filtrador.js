const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtrador')
        .setDescription('Baneo global')
        .addStringOption(o => o.setName('id').setDescription('ID usuario').setRequired(true))
        .addStringOption(o => o.setName('motivo').setDescription('Razón').setRequired(true))
        .addStringOption(o => o.setName('evidencia').setDescription('Link evidencia').setRequired(true)),

    async execute(interaction) {
        const STAFF = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF.some(id => interaction.member.roles.cache.has(id))) return interaction.reply("No autorizado.");

        const id = interaction.options.getString('id');
        const motivo = interaction.options.getString('motivo');
        const ev = interaction.options.getString('evidencia');

        await db.collection('BANEOS').doc(id).set({ id, motivo, ev, fecha: new Date() });

        const globalLog = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
        if (globalLog) globalLog.send(`🚨 **Global Ban**: <@${id}> | Motivo: ${motivo}`);

        const servidores = await db.collection('SERVIDORES').get();
        servidores.forEach(async doc => {
            const s = doc.data();
            const guild = interaction.client.guilds.cache.get(s.guildId);
            if (!guild) return;

            const cSanciones = guild.channels.cache.get(s.canalSanciones);
            const cAvisos = guild.channels.cache.get(s.canalAvisos);

            if (s.modo === 'AutoBan') {
                try {
                    await guild.members.ban(id, { reason: `Filtrador: ${motivo}` });
                    if (cSanciones) {
                        const emb = new EmbedBuilder().setTitle("🚫 Usuario Baneado").setColor("Red")
                            .addFields({name: "ID", value: id}, {name: "Evidencia", value: ev});
                        cSanciones.send({ embeds: [emb] });
                    }
                    if (cAvisos) cAvisos.send(`El filtra <@${id}> ha sido baneado.`);
                } catch (e) {}
            } else if (cAvisos) {
                cAvisos.send(`<@&${s.rolStaff}> ⚠️ Filtrador detectado: <@${id}>. Evidencia: ${ev}`);
            }
        });
        await interaction.reply("✅ Acción global completada.");
    }
};
