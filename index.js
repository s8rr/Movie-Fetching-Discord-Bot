require("dotenv").config(); // Load environment variables

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    SelectMenuInteraction,
} = require("discord.js");
const axios = require("axios");

// Create the Discord bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageTyping,
    ],
});

// TMDB API key from environment variables
const tmdbApiKey = process.env.TMDB_API_KEY;
const prefix = "!"; // Bot command prefix

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Respond to the old-style commands like !movie
client.on("messageCreate", async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message starts with the prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/); // Split message into arguments
    const command = args.shift().toLowerCase(); // Get the command name

    if (command === "movie" && args.length > 0) {
        const movieName = args.join(" "); // Join the arguments to form the movie name

        try {
            const searchResponse = await axios.get(
                `https://api.themoviedb.org/3/search/movie`,
                {
                    params: {
                        api_key: tmdbApiKey,
                        query: movieName,
                    },
                },
            );

            const movies = searchResponse.data.results;

            if (movies.length > 0) {
                const options = movies.map((movie) => ({
                    label: movie.title,
                    value: movie.id.toString(), // Use the movie ID as the value
                }));

                // Create a select menu for the user to choose a specific movie
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("movie_select")
                    .setPlaceholder("Select a movie...")
                    .addOptions(options);

                const actionRow = new ActionRowBuilder().addComponents(
                    selectMenu,
                );

                await message.channel.send({
                    content: `Multiple results found for "${movieName}". Please select one:`,
                    components: [actionRow],
                });
            } else {
                await message.channel.send(
                    `No results found for "${movieName}".`,
                );
            }
        } catch (error) {
            console.error(error);
            await message.channel.send(
                "Sorry, there was an error fetching the movie details.",
            );
        }
    }
});

// Handle the selection of a movie
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isSelectMenu()) return; // Ignore non-select interactions

    const movieId = interaction.values[0]; // Get the selected movie ID
    const userId = interaction.user.id; // Get the user ID

    // Fetch movie details
    try {
        const detailsResponse = await axios.get(
            `https://api.themoviedb.org/3/movie/${movieId}`,
            {
                params: {
                    api_key: tmdbApiKey,
                    append_to_response: "credits", // Include cast information
                },
            },
        );

        const movieDetails = detailsResponse.data;
        const cast = movieDetails.credits.cast
            .slice(0, 5) // Get the top 5 cast members
            .map((member) => member.name)
            .join(", ");

        const genres = movieDetails.genres
            .map((genre) => genre.name)
            .join(", "); // Get genres
        const budget = movieDetails.budget
            ? `$${movieDetails.budget.toLocaleString()}`
            : "N/A"; // Format budget
        const revenue = movieDetails.revenue
            ? `$${movieDetails.revenue.toLocaleString()}`
            : "N/A"; // Format revenue
        const userScore = movieDetails.vote_average
            ? `${movieDetails.vote_average}/10`
            : "N/A"; // Get user score

        // Create a modern embed message
        const movieEmbed = new EmbedBuilder()
            .setColor("#ffcc00") // Set a vibrant color
            .setTitle(movieDetails.title) // Set the title of the embed
            .setURL(`https://www.themoviedb.org/movie/${movieDetails.id}`) // Set the URL to the movie's TMDB page
            .setDescription(movieDetails.overview) // Set the description of the embed
            .addFields(
                {
                    name: "Release Date",
                    value: movieDetails.release_date,
                    inline: true,
                }, // Add a field for release date
                { name: "Rating", value: userScore, inline: true }, // Add a field for user score
                {
                    name: "Genres",
                    value: genres || "No genres available.",
                    inline: false,
                }, // Add genres information
                {
                    name: "Cast",
                    value: cast || "No cast information available.",
                    inline: false,
                }, // Add cast information
                {
                    name: "Language",
                    value: movieDetails.original_language.toUpperCase(),
                    inline: true,
                }, // Add language
                {
                    name: "Runtime",
                    value: `${movieDetails.runtime} minutes`,
                    inline: true,
                }, // Add runtime
                { name: "Budget", value: budget, inline: true }, // Add budget
                { name: "Revenue", value: revenue, inline: true }, // Add revenue
            )
            .setImage(
                `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`,
            ) // Set the image (poster) of the movie
            .setTimestamp() // Add a timestamp
            .setFooter({
                text: "Movie information provided by TMDB",
                iconURL: client.user.displayAvatarURL(),
            }); // Add a footer with bot's avatar

        // Create buttons for trailer and IMDb
        const watchTrailerButton = new ButtonBuilder()
            .setLabel("Watch Trailer")
            .setStyle(ButtonStyle.Link)
            .setURL(
                `https://www.youtube.com/results?search_query=${encodeURIComponent(movieDetails.title + " trailer")}`,
            ); // Link to YouTube search for the trailer

        const viewIMDbButton = new ButtonBuilder()
            .setLabel("View on IMDb")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.imdb.com/title/tt${movieDetails.imdb_id}`); // Link to the IMDb page (assuming imdb_id is provided)

        // Create an action row for buttons
        const actionRow = new ActionRowBuilder().addComponents(
            watchTrailerButton,
            viewIMDbButton,
        );

        await interaction.reply({
            embeds: [movieEmbed],
            components: [actionRow],
            ephemeral: true,
        }); // Send the embed message with buttons to the user only
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: "Sorry, there was an error fetching the movie details.",
            ephemeral: true,
        }); // Send error to user only
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
