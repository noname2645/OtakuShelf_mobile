import axios from 'axios';

// Cache configuration
let heroCache = { data: null, timestamp: 0 };
const HERO_TTL = 6 * 60 * 60 * 1000; // 6 hours
let fallbackCache = { data: null, timestamp: 0 };

const axiosConfig = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://anilist.co',
        // 'Referer': 'https://anilist.co', // Referer might be restricted in some environments, usually safer to omit or use app identifier
        'User-Agent': 'OtakuShelf/1.0'
    }
};

// Get current season
const getCurrentSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 12 || month <= 2) return 'WINTER';
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    return 'FALL';
};

// Multiple query strategies
const getQueryStrategies = () => {
    const currentYear = new Date().getFullYear();
    const currentSeason = getCurrentSeason();

    return [
        // Strategy 1: Current season with lower score threshold
        {
            name: "Current Season",
            variables: {
                season: currentSeason,
                seasonYear: currentYear,
                scoreThreshold: 60
            }
        },
        // Strategy 2: Popular recent anime (last 2 years)
        {
            name: "Recent Popular",
            variables: {
                startYear: currentYear - 1,
                endYear: currentYear,
                scoreThreshold: 65
            }
        },
        // Strategy 3: All-time popular with trailers (no season restriction)
        {
            name: "All Time Popular",
            variables: {
                scoreThreshold: 70
            }
        },
        // Strategy 4: Most lenient - just popular anime with trailers
        {
            name: "Most Lenient",
            variables: {
                scoreThreshold: 50
            }
        }
    ];
};

// Build dynamic query
const buildQuery = (strategy) => {
    const { variables } = strategy;

    let queryConditions = [
        'type: ANIME',
        'isAdult: false',
        'status_in: [RELEASING, NOT_YET_RELEASED, FINISHED]'
    ];

    if (variables.season && variables.seasonYear) {
        queryConditions.push(`season: $season`);
        queryConditions.push(`seasonYear: $seasonYear`);
    }

    if (variables.startYear && variables.endYear) {
        queryConditions.push(`startDate_greater: "${variables.startYear}-01-01"`);
        queryConditions.push(`startDate_lesser: "${variables.endYear}-12-31"`);
    }

    if (variables.scoreThreshold) {
        queryConditions.push(`averageScore_greater: ${variables.scoreThreshold}`);
    }

    return `
    query ${variables.season ? '($season: MediaSeason, $seasonYear: Int)' : ''} {
      Page(perPage: 100) {
        media(
          sort: [POPULARITY_DESC, TRENDING_DESC, SCORE_DESC]
          ${queryConditions.join('\n          ')}
        ) {
          id
          title { romaji english native }
          description(asHtml: false)
          status
          season
          seasonYear
          episodes
          averageScore
          popularity
          bannerImage
          coverImage { large extraLarge }
          genres
          format  
          startDate { year month day } 
          endDate { year month day }   
          studios {
            nodes { name isAnimationStudio }
          }
          trailer { id site thumbnail }
        }
      }
    }
  `;
};

// Fetch anime with strategies
const fetchAnimeWithStrategies = async () => {
    const strategies = getQueryStrategies();

    for (const strategy of strategies) {
        try {
            console.log(`[AniList] Trying strategy: ${strategy.name}`);

            const query = buildQuery(strategy);
            const variables = {};

            if (strategy.variables.season) variables.season = strategy.variables.season;
            if (strategy.variables.seasonYear) variables.seasonYear = strategy.variables.seasonYear;

            const response = await axios.post(
                'https://graphql.anilist.co',
                { query, variables },
                axiosConfig
            );

            const media = response.data?.data?.Page?.media || [];
            console.log(`[AniList] ${strategy.name} returned ${media.length} results`);

            const filtered = media.filter(anime => {
                const hasTrailer = anime.trailer?.id && anime.trailer?.site;
                const hasImage = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large;
                const hasDecentScore = !anime.averageScore || anime.averageScore >= 50;
                const hasBasicInfo = anime.title && (anime.title.english || anime.title.romaji);

                return hasTrailer && hasImage && hasDecentScore && hasBasicInfo;
            });

            if (filtered.length >= 10) {
                // Shuffle and take top results to keep it fresh
                const shuffled = filtered.sort(() => Math.random() - 0.5);
                const limited = shuffled.slice(0, 20); // Get top 20 for rotation

                return limited.map(anime => ({
                    ...anime,
                    displayTitle: anime.title.english || anime.title.romaji || anime.title.native,
                    mainStudio: anime.studios?.nodes?.find(s => s.isAnimationStudio)?.name || 'Unknown Studio',
                }));
            }

        } catch (error) {
            console.log(`[AniList] Strategy ${strategy.name} failed:`, error.message);
            continue;
        }
    }

    return [];
};

// Main export function
export const fetchHeroTrailers = async (forceRefresh = false) => {
    const now = Date.now();

    // Return cached data if valid
    if (!forceRefresh && heroCache.data && heroCache.data.length > 0 && now - heroCache.timestamp < HERO_TTL) {
        console.log('[AniList] Returning cached hero trailers');
        return heroCache.data;
    }

    console.log('[AniList] Fetching fresh hero trailers...');
    try {
        const enhanced = await fetchAnimeWithStrategies();

        if (enhanced.length > 0) {
            heroCache = { data: enhanced, timestamp: now };
            fallbackCache = { data: enhanced, timestamp: now };
            return enhanced;
        }

        // If fetch returned empty, try fallback cache
        if (fallbackCache.data && fallbackCache.data.length > 0) {
            console.log('[AniList] Using fallback cache');
            return fallbackCache.data;
        }

        return [];
    } catch (err) {
        console.error('[AniList] Error fetching trailers:', err.message);

        if (heroCache.data) return heroCache.data;
        if (fallbackCache.data) return fallbackCache.data;

        return [];
    }
};
