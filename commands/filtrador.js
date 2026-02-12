const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtrador')
        .setDescription('Baneo global forzado')
        .addStringOption(o => o.setName('id').setDescription('ID del usuario').setRequired(true))
        .addStringOption(o => o.setName('motivo').setDescription('Razón').setRequired(true))
        .addStringOption(o => o.setName('evidencia').setDescription('Link evidencia').setRequired(true)),

    async execute(interaction) {
        const STAFF = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF.some(id => interaction.member.roles.cache.has(id))) return interaction.reply("No autorizado.");

        const id = interaction.options.getString('id');
        const motivo = interaction.options.getString('motivo');
        const ev = interaction.options.getString('evidencia');

        await interaction.deferReply();

        // Guardar en BANEOS
        await db.collection('BANEOS').doc(id).set({ id, motivo, ev, fecha: new Date() });

        // Log Global Main
        const globalLog = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
        if (globalLog) globalLog.send(`🚨 **Global Ban**: <@${id}> expulsado.\n**Motivo**: ${motivo}\n**Evidencia**: ${ev}`);

        // Recorrer SERVIDORES de la DB
        const servidores = await db.collection('SERVIDORES').get();
        
        for (const doc of servidores.docs) {
            const s = doc.data();
            try {
                // FETCH FORZADO para asegurar que encuentre el server
                const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
                if (!guild) continue;

                const cSanciones = await guild.channels.fetch(s.canalSanciones).catch(() => null);
                const cAvisos = await guild.channels.fetch(s.canalAvisos).catch(() => null);

                if (s.modo === 'AutoBan') {
                    // Baneo por ID (aunque no esté en el server)
                    await guild.members.ban(id, { reason: `Filtrador: ${motivo}` }).catch(() => null);
                    
                    if (cSanciones) {
                        const bEmbed = new EmbedBuilder().setTitle("🚫 Ban Global").setColor("Red")
                            .addFields({name: "Filtra", value: `<@${id}>`}, {name: "Evidencia", value: ev});
                        cSanciones.send({ embeds: [bEmbed] });
                    }
                    if (cAvisos) cAvisos.send(`El filtra <@${id}> ha sido baneado.`);
                } else if (cAvisos) {
                    cAvisos.send(`<@&${s.rolStaff}> ⚠️ Alerta Global: <@${id}> es un filtra. Evidencia: ${ev}`);
                }
            } catch (err) { console.error(`Fallo en guild ${s.guildId}`); }
        }

        await interaction.editReply("✅ El baneo global se ha procesado con éxito.");
    }
};
