const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filtrador')
    .setDescription('Baneo Global')
    .addStringOption(o => o.setName('id').setRequired(true).setDescription('ID'))
    .addStringOption(o => o.setName('motivo').setRequired(true).setDescription('Razón'))
    .addStringOption(o => o.setName('evidencia').setRequired(true).setDescription('Link')),

  async execute(interaction) {
    if (!interaction.client.configGlobal.bansEnabled) return interaction.reply({ content: "❌ Baneos globales desactivados.", ephemeral: true });

    const STAFF = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
    if (!STAFF.some(id => interaction.member.roles.cache.has(id))) return interaction.reply("No autorizado.");

    const id = interaction.options.getString('id'), mot = interaction.options.getString('motivo'), ev = interaction.options.getString('evidencia');
    await interaction.deferReply();

    await db.collection('BANEOS').doc(id).set({ id, mot, ev, fecha: new Date() });

    const logGlobal = await interaction.client.channels.fetch('1412415386971799693').catch(() => null);
    if (logGlobal) logGlobal.send(`🚨 **Global Ban**: <@${id}> | ${mot}`);

    const servidores = await db.collection('SERVIDORES').get();
    for (const doc of servidores.docs) {
      const s = doc.data();
      const guild = await interaction.client.guilds.fetch(s.guildId).catch(() => null);
      if (!guild) continue;

      if (s.modo === 'AutoBan') {
        await guild.members.ban(id, { reason: `Filtra: ${mot}` }).catch(() => null);
        const log = await guild.channels.fetch(s.canalSanciones).catch(() => null);
        if (log) log.send({ embeds: [new EmbedBuilder().setTitle("Ban Global").setDescription(`<@${id}> expulsado.\nEv: ${ev}`).setColor("Red")] });
      } else {
        const avisos = await guild.channels.fetch(s.canalAvisos).catch(() => null);
        if (avisos) avisos.send(`<@&${s.rolStaff}> ⚠️ Alerta: <@${id}> marcado. Ev: ${ev}`);
      }
    }
    await interaction.editReply("✅ Procesado.");
  }
};
