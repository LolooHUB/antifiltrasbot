const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('⚙️ Configuración del sistema de seguridad Anti-Filtras')
        .addChannelOption(o => o.setName('logs').setDescription('Canal donde se enviarán los registros de baneo').setRequired(true))
        .addChannelOption(o => o.setName('alertas').setDescription('Canal para avisos urgentes al Staff').setRequired(true))
        .addRoleOption(o => o.setName('staff').setDescription('Rol que recibirá las menciones de alerta').setRequired(true))
        .addStringOption(o => o.setName('modo').setDescription('Comportamiento del sistema ante un filtra detectado').setRequired(true)
            .addChoices(
                { name: '🛡️ AutoBan (Recomendado)', value: 'AutoBan' },
                { name: '⚠️ AvisoStaff (Solo alerta)', value: 'AvisoStaff' }
            ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // BLINDAJE: Solo el dueño absoluto del servidor puede usar este comando
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ 
                content: "❌ **Acceso Denegado:** Por seguridad, solo el **Owner** del servidor puede configurar el sistema Anti-Filtras.", 
                ephemeral: true 
            });
        }

        const logo = new AttachmentBuilder('./logo.webp');
        const config = {
            guildId: interaction.guild.id,
            serverName: interaction.guild.name,
            canalSanciones: interaction.options.getChannel('logs').id,
            canalAvisos: interaction.options.getChannel('alertas').id,
            rolStaff: interaction.options.getRole('staff').id,
            modo: interaction.options.getString('modo'),
            configuradoPor: interaction.user.tag,
            ultimaActualizacion: new Date()
        };

        await db.collection('SERVIDORES').doc(interaction.guild.id).set(config, { merge: true });

        const setupEmbed = new EmbedBuilder()
            .setAuthor({ name: "SISTEMA CONFIGURADO", iconURL: 'attachment://logo.webp' })
            .setColor("#00ff88")
            .setDescription(`La seguridad ha sido establecida con éxito en **${interaction.guild.name}**.`)
            .addFields(
                { name: "🛡️ Modo de Acción", value: `\`${config.modo}\``, inline: true },
                { name: "👮 Rol Staff", value: `<@&${config.rolStaff}>`, inline: true }
            )
            .setThumbnail('attachment://logo.webp')
            .setFooter({ text: "Protección Global Activa" });

        await interaction.reply({ embeds: [setupEmbed], files: [logo], ephemeral: true });
    }
};
