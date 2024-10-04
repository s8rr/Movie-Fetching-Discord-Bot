require("dotenv").config();
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
    new SlashCommandBuilder()
        .setName("movie")
        .setDescription("Fetches details about a movie.")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The name of the movie")
                .setRequired(true),
        ),
];

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log("Started refreshing application (/) commands.");
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID,
            ),
            { body: commands.map((command) => command.toJSON()) },
        );
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
