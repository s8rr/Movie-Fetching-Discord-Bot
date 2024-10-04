require("dotenv").config(); // Load environment variables

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    SelectMenuBuilder,
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

// Store movie data for each user
const userMovieData = {}; // Keyed by user ID

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
                userMovieData[message.author.id] = { movies, currentPage: 0 }; // Store movies and current page for the user
                await sendMovieSelectionMenu(message.channel, movies); // Send the dropdown menu for movie selection
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

// Function to send the dropdown menu for movie selection
async function sendMovieSelectionMenu(channel, movies) {
    const movieOptions = movies.map((movie) => ({
        label: movie.title,
        value: movie.id.toString(), // Use movie ID as the value for the dropdown
    }));

    const selectMenu = new SelectMenuBuilder()
        .setCustomId("select_movie")
        .setPlaceholder("Select a movie...")
        .addOptions(movieOptions);

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({
        content: "Please select a movie from the dropdown:",
        components: [actionRow],
    });
}

// Function to send the movie embed based on current page
async function sendMovieEmbed(channel, userId, movies, page) {
    const movie = movies[page]; // Get the movie for the current page

    // Fetch credits for the selected movie
    let cast = [];
    try {
        const creditsResponse = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/credits`,
            {
                params: {
                    api_key: tmdbApiKey,
                },
            },
        );
        cast = creditsResponse.data.cast
            .slice(0, 5)
            .map((member) => member.name); // Get the top 5 cast members
    } catch (error) {
        console.error("Error fetching movie credits:", error);
    }

    const genres = movie.genre_ids.map((id) => getGenreName(id)).join(", "); // Get genres by ID
    const budget = movie.budget ? `$${movie.budget.toLocaleString()}` : "N/A"; // Format budget
    const revenue = movie.revenue
        ? `$${movie.revenue.toLocaleString()}`
        : "N/A"; // Format revenue
    const userScore = movie.vote_average ? `${movie.vote_average}/10` : "N/A"; // Get user score

    // Create a modern embed message
    const movieEmbed = new EmbedBuilder()
        .setColor("#ffcc00") // Set a vibrant color
        .setTitle(movie.title) // Set the title of the embed
        .setURL(`https://www.themoviedb.org/movie/${movie.id}`) // Set the URL to the movie's TMDB page
        .setDescription(movie.overview) // Set the description of the embed
        .addFields(
            { name: "Release Date", value: movie.release_date, inline: true }, // Add a field for release date
            { name: "Rating", value: userScore, inline: true }, // Add a field for user score
            {
                name: "Genres",
                value: genres || "No genres available.",
                inline: false,
            }, // Add genres information
            {
                name: "Cast",
                value: cast.join(", ") || "No cast information available.",
                inline: false,
            }, // Add cast information
            {
                name: "Language",
                value: movie.original_language.toUpperCase(),
                inline: true,
            }, // Add language
            {
                name: "Runtime",
                value: `${movie.runtime} minutes`,
                inline: true,
            }, // Add runtime
            { name: "Budget", value: budget, inline: true }, // Add budget
            { name: "Revenue", value: revenue, inline: true }, // Add revenue
        )
        .setImage(`https://image.tmdb.org/t/p/w500${movie.poster_path}`) // Set the image (poster) of the movie
        .setTimestamp() // Add a timestamp
        .setFooter({
            text: "Movie information provided by TMDB",
            iconURL: client.user.displayAvatarURL(),
        }); // Add a footer with bot's avatar

    // Create buttons for navigation
    const previousButton = new ButtonBuilder()
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setCustomId("previous_movie")
        .setDisabled(page === 0); // Disable if on the first page

    const nextButton = new ButtonBuilder()
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setCustomId("next_movie")
        .setDisabled(page === movies.length - 1); // Disable if on the last page

    const searchButton = new ButtonBuilder()
        .setLabel("Search")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId("search_movie"); // Custom ID for the search button

    const actionRow = new ActionRowBuilder().addComponents(
        previousButton,
        nextButton,
        searchButton,
    );

    // Send the embed and buttons to the channel
    await channel.send({ embeds: [movieEmbed], components: [actionRow] });
}

// Function to get genre name by ID
function getGenreName(id) {
    const genreMap = {
        28: "Action",
        12: "Adventure",
        16: "Animation",
        35: "Comedy",
        80: "Crime",
        99: "Documentary",
        18: "Drama",
        10751: "Family",
        14: "Fantasy",
        36: "History",
        27: "Horror",
        10402: "Music",
        9648: "Mystery",
        10749: "Romance",
        878: "Science Fiction",
        10770: "TV Movie",
        53: "Thriller",
        10752: "War",
        37: "Western",
    };
    return genreMap[id] || "Unknown";
}

// Handle interaction for movie selection and pagination
client.on("interactionCreate", async (interaction) => {
    if (interaction.isSelectMenu()) {
        const userId = interaction.user.id;
        const movieData = userMovieData[userId]; // Get movie data for the user

        if (!movieData) return; // If no data exists for the user, ignore

        const selectedMovieId = interaction.values[0]; // Get the selected movie ID
        const selectedMovieIndex = movieData.movies.findIndex(
            (movie) => movie.id.toString() === selectedMovieId,
        ); // Find the index of the selected movie

        if (selectedMovieIndex !== -1) {
            movieData.currentPage = selectedMovieIndex; // Set the current page to the selected movie
            await sendMovieEmbed(
                interaction.channel,
                userId,
                movieData.movies,
                movieData.currentPage,
            ); // Send the selected movie details
        }
    } else if (interaction.isButton()) {
        const userId = interaction.user.id;
        const movieData = userMovieData[userId]; // Get movie data for the user

        if (!movieData) return; // If no data exists for the user, ignore

        const movies = movieData.movies;
        const currentPage = movieData.currentPage;

        if (interaction.customId === "next_movie") {
            if (currentPage < movies.length - 1) {
                movieData.currentPage += 1; // Move to the next page
                await sendMovieEmbed(
                    interaction.channel,
                    userId,
                    movies,
                    movieData.currentPage,
                ); // Send the next movie details
            }
        } else if (interaction.customId === "previous_movie") {
            if (currentPage > 0) {
                movieData.currentPage -= 1; // Move to the previous page
                await sendMovieEmbed(
                    interaction.channel,
                    userId,
                    movies,
                    movieData.currentPage,
                ); // Send the previous movie details
            }
        } else if (interaction.customId === "search_movie") {
            await interaction.reply({
                content: "Please type your search query:",
                ephemeral: true,
            }); // Reply to prompt the user for search input
            // Implement logic to handle Discord input for search query
        }
    }
});

// Login to the Discord bot
client.login(process.env.DISCORD_TOKEN);
