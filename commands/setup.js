const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('⚙️ Configuración de seguridad local')
        .addChannelOption(o => o.setName('logs').setDescription('Logs de baneo').setRequired(true))
        .addChannelOption(o => o.setName('alertas').setDescription('Alertas staff').setRequired(true))
        .addRoleOption(o => o.setName('staff').setDescription('Rol staff').setRequired(true))
        .addStringOption(o => o.setName('modo').setDescription('Acción').setRequired(true)
            .addChoices({ name: 'AutoBan', value: 'AutoBan' }, { name: 'Aviso', value: 'AvisoStaff' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "❌ Solo el Dueño del Servidor puede configurar el bot.", ephemeral: true });
        }

        const config = {
            guildId: interaction.guild.id,
            canalSanciones: interaction.options.getChannel('logs').id,
            canalAvisos: interaction.options.getChannel('alertas').id,
            modo: interaction.options.getString('modo'),
            rolStaff: interaction.options.getRole('staff').id
        };

        await db.collection('SERVIDORES').doc(interaction.guild.id).set(config);
        await interaction.reply({ content: "✅ Configuración guardada.", ephemeral: true });
    }
};
