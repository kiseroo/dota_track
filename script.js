document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-btn');
    const playerInput = document.getElementById('player-input');
    const playerDetails = document.getElementById('player-details');
    const matchesContainer = document.getElementById('matches-container');
    const matchModal = document.getElementById('match-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModal = document.querySelector('.close-modal');
    
    // OpenDota API endpoint
    const OPENDOTA_API_URL = 'https://api.opendota.com/api';
    
    // Hero and item data cache
    let heroesData = {};
    let itemsData = {};
    let currentPlayerId = '';
    
    // Fetch heroes data on load
    fetchHeroesData();
    fetchItemsData();
    
    // Initialize with default player ID if available
    if (playerInput.value.trim() !== '') {
        fetchPlayerData();
    }
    
    searchButton.addEventListener('click', () => {
        fetchPlayerData();
    });
    
    playerInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            fetchPlayerData();
        }
    });
    
    // Close modal when clicking the X or outside the modal
    closeModal.addEventListener('click', () => {
        matchModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === matchModal) {
            matchModal.style.display = 'none';
        }
    });
    
    // Fetch heroes data from OpenDota API
    function fetchHeroesData() {
        fetch(`${OPENDOTA_API_URL}/heroes`)
            .then(response => response.json())
            .then(data => {
                // Convert array to object with hero_id as key
                heroesData = data.reduce((acc, hero) => {
                    acc[hero.id] = hero;
                    return acc;
                }, {});
            })
            .catch(error => {
                console.error('Error fetching heroes data:', error);
            });
    }
    
    // Fetch items data from OpenDota API
    function fetchItemsData() {
        fetch(`${OPENDOTA_API_URL}/constants/items`)
            .then(response => response.json())
            .then(data => {
                itemsData = data;
            })
            .catch(error => {
                console.error('Error fetching items data:', error);
            });
    }
    
    function fetchPlayerData() {
        let playerId = playerInput.value.trim();
        
        if (playerId === '') {
            displayError('Please enter a Steam ID, Dota 2 player name, or Steam profile URL');
            return;
        }
        
        console.log('Processing input:', playerId);
        
        // Handle complete URLs (both http and https)
        if (playerId.includes('steamcommunity.com')) {
            try {
                // Make sure we have a proper URL by adding protocol if missing
                if (!playerId.startsWith('http')) {
                    playerId = 'https://' + playerId;
                }
                
                // Clean up URL - ensure it doesn't have trailing slashes or extra parameters
                let urlObj;
                try {
                    urlObj = new URL(playerId);
                } catch (error) {
                    console.error('Invalid URL format:', error);
                    displayError('Invalid Steam URL format. Please check the URL.');
                    return;
                }
                
                // Remove query parameters and hashes for consistent path processing
                const cleanUrl = urlObj.origin + urlObj.pathname;
                console.log('Cleaned URL:', cleanUrl);
                
                const pathParts = urlObj.pathname.split('/').filter(part => part);
                console.log('URL path parts:', pathParts);
                
                // Handle /profiles/[steamid] format
                if (pathParts.length >= 2 && pathParts[0] === 'profiles') {
                    const steamId = pathParts[1];
                    console.log('Extracted Steam ID from profiles URL:', steamId);
                    
                    // Convert from Steam64 to Steam32 for OpenDota API
                    try {
                        const steam32Id = steam64ToSteam32(steamId);
                        console.log('Converted to Steam32 ID:', steam32Id);
                        fetchPlayerDataById(steam32Id);
                    } catch (error) {
                        console.error('Steam ID conversion error:', error);
                        displayError('Invalid Steam ID format. Please check your URL.');
                    }
                    return;
                }
                
                // Handle /id/[vanityname] format - Improved handling for custom vanity URLs
                if (pathParts.length >= 2 && pathParts[0] === 'id') {
                    const vanityName = pathParts[1];
                    console.log('Extracted vanity name from URL:', vanityName);
                    
                    // Show loading message
                    playerDetails.innerHTML = `
                        <div class="loading">
                            <div class="gem-loader"></div>
                            <p>Resolving Steam vanity URL...</p>
                        </div>`;
                    
                    // IMPROVED: First try the Steam Web API (if you have a key)
                    // For this example, we'll still use OpenDota but with improved handling
                    resolveVanityUrl(vanityName);
                    return;
                }
                
                // Handle older URL formats or other variations
                if (pathParts.length >= 1) {
                    // As a fallback, try to use the last path component as a potential vanity name
                    const possibleVanityName = pathParts[pathParts.length - 1];
                    console.log('Trying last path component as vanity name:', possibleVanityName);
                    
                    // Show loading message
                    playerDetails.innerHTML = `
                        <div class="loading">
                            <div class="gem-loader"></div>
                            <p>Resolving Steam URL...</p>
                        </div>`;
                    
                    // Use improved vanity URL resolution
                    resolveVanityUrl(possibleVanityName);
                    return;
                }
                
                throw new Error('Unrecognized Steam URL format');
            } catch (error) {
                console.error('URL parsing error:', error);
                displayError('Invalid Steam URL format. Please enter a valid Steam profile URL');
                return;
            }
        }
        
        // Handle Steam64 ID format (any variations)
        if (/^76561\d+$/.test(playerId)) {
            console.log('Detected Steam64 ID format');
            try {
                playerId = steam64ToSteam32(playerId);
                console.log('Converted to Steam32 ID:', playerId);
                fetchPlayerDataById(playerId);
                return;
            } catch (error) {
                console.error('Steam ID conversion error:', error);
                displayError('Invalid Steam ID format');
                return;
            }
        }
        
        // If we get here, we have either a numeric Steam32 ID or a player name/vanity URL
        if (/^\d+$/.test(playerId)) {
            console.log('Using numeric ID directly:', playerId);
            fetchPlayerDataById(playerId);
        } else {
            // If it's not a numeric ID, try to resolve it as a player name or vanity URL
            console.log('Attempting to resolve player name or vanity URL:', playerId);
            
            // Show loading message
            playerDetails.innerHTML = `
                <div class="loading">
                    <div class="gem-loader"></div>
                    <p>Resolving player name...</p>
                </div>`;
                
            // Use improved resolution function
            resolveVanityUrl(playerId);
        }
    }
    
    // Fixed function to better handle vanity URL resolution with more fallbacks
    function resolveVanityUrl(vanityName) {
        // Show better loading message
        playerDetails.innerHTML = `
            <div class="loading">
                <div class="gem-loader"></div>
                <p>Looking up player: <strong>${vanityName}</strong>...</p>
            </div>`;
            
        // First try OpenDota's resolve endpoint
        fetch(`${OPENDOTA_API_URL}/players/resolve?vanityUrl=${encodeURIComponent(vanityName)}`)
            .then(response => {
                if (!response.ok) {
                    console.warn('First resolution attempt failed. Trying alternative approach...');
                    throw new Error('First attempt failed');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.account_id) {
                    console.log('Resolved vanity URL to ID:', data.account_id);
                    fetchPlayerDataById(data.account_id);
                } else {
                    throw new Error('Could not resolve vanity URL to a valid Steam ID');
                }
            })
            .catch(error => {
                console.error('First resolution error:', error);
                
                // IMPROVED: Second approach - Try search endpoint with better matching
                console.log('Trying alternative resolution approach with search...');
                fetch(`${OPENDOTA_API_URL}/search?q=${encodeURIComponent(vanityName)}`)
                    .then(response => response.json())
                    .then(results => {
                        console.log('Search results:', results);
                        if (results && results.length > 0) {
                            // FIXED: Better matching algorithm with proper scope variables
                            const possibleMatches = results.filter(r => r.account_id);
                            
                            // First try exact name match (case insensitive)
                            let foundPlayer = possibleMatches.find(r => 
                                r.personaname && r.personaname.toLowerCase() === vanityName.toLowerCase()
                            );
                            
                            // Then try account_id match
                            if (!foundPlayer) {
                                foundPlayer = possibleMatches.find(r => r.account_id.toString() === vanityName);
                            }
                            
                            // FIXED: Check for steamid in each match correctly
                            if (!foundPlayer) {
                                foundPlayer = possibleMatches.find(r => 
                                    r.steamid && r.steamid.includes(vanityName)
                                );
                            }
                            
                            // Then try if vanityName is part of personaname (partial match)
                            if (!foundPlayer) {
                                foundPlayer = possibleMatches.find(r => 
                                    r.personaname && r.personaname.toLowerCase().includes(vanityName.toLowerCase())
                                );
                            }
                            
                            // Then try if personaname is part of vanityName  
                            if (!foundPlayer) {
                                foundPlayer = possibleMatches.find(r => 
                                    r.personaname && vanityName.toLowerCase().includes(r.personaname.toLowerCase())
                                );
                            }
                            
                            // If we found any match, use it
                            if (foundPlayer) {
                                console.log('Found player via improved matching:', foundPlayer);
                                fetchPlayerDataById(foundPlayer.account_id);
                                return;
                            }
                            
                            // Last resort: use the first player with an account_id
                            if (possibleMatches.length > 0) {
                                console.log('Using first available player in search results:', possibleMatches[0]);
                                fetchPlayerDataById(possibleMatches[0].account_id);
                                return;
                            }
                        }

                        // Try Steam API with a direct call
                        console.log('Trying direct API call for Steam vanity URL...');
                        fetch(`${OPENDOTA_API_URL}/players/matches?name=${encodeURIComponent(vanityName)}`)
                            .then(response => {
                                if (!response.ok) throw new Error('Direct name query failed');
                                return response.json();
                            })
                            .then(data => {
                                if (data && data.length > 0 && data[0].account_id) {
                                    console.log('Found player via direct match API:', data[0].account_id);
                                    fetchPlayerDataById(data[0].account_id);
                                    return;
                                }
                                throw new Error('No matches found for this name');
                            })
                            .catch(matchError => {
                                console.error('All resolution methods failed:', matchError);
                                displayError(`
                                    <strong>Could not find player "${vanityName}"</strong>
                                    <p>We tried multiple ways to find this player but couldn't find a match.</p>
                                    <p>Try using the player's numeric Steam ID or their exact Steam profile URL.</p>
                                    <p>Example: <code>https://steamcommunity.com/id/lakiimgl</code></p>
                                `);
                            });
                    })
                    .catch(searchError => {
                        console.error('Search resolution failed:', searchError);
                        displayError(`
                            <strong>Could not resolve this player name or custom URL</strong>
                            <p>The OpenDota API couldn't find a match for "${vanityName}".</p>
                            <p>Try using the complete Steam profile URL instead.</p>
                        `);
                    });
            });
    }
    
    function steam64ToSteam32(steam64) {
        // Steam64 IDs are very large numbers, so we need to use BigInt
        try {
            // Remove the "76561198" prefix if it exists
            if (steam64.startsWith('76561198')) {
                const steam32 = BigInt(steam64) - BigInt('76561197960265728');
                return steam32.toString();
            } else if (/^7656\d+$/.test(steam64)) {
                const steam32 = BigInt(steam64) - BigInt('76561197960265728');
                return steam32.toString();
            } else {
                // If it's already a Steam32 ID, return it as is
                return steam64;
            }
        } catch (error) {
            console.error('Error converting Steam ID:', error);
            throw new Error('Invalid Steam64 ID format');
        }
    }
    
    function fetchPlayerDataById(playerId) {
        currentPlayerId = playerId;
        
        // Show loading message with animated loader
        playerDetails.innerHTML = `
            <div class="loading">
                <div class="gem-loader"></div>
                <p>Loading player data...</p>
            </div>`;
        matchesContainer.innerHTML = '';
        
        console.log('Starting API requests for Steam ID:', playerId);
        
        // First, get player details
        fetch(`${OPENDOTA_API_URL}/players/${playerId}`)
            .then(response => {
                console.log('Player API response status:', response.status);
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Player not found. Check the Steam ID and try again.');
                    } else if (response.status === 400) {
                        throw new Error('Invalid Steam ID format. Please use a numeric Steam ID or a valid Steam profile URL.');
                    } else {
                        throw new Error(`OpenDota API server error: ${response.status}`);
                    }
                }
                return response.json();
            })
            .then(data => {
                console.log('Player data received:', data);
                
                // Check if the profile data exists
                if (!data || !data.profile) {
                    console.error('Missing profile data in API response:', data);
                    throw new Error('Invalid player data: Missing profile information. This player may not have Dota 2 profile data available.');
                }
                
                // Also fetch win/loss counts for better stats
                return Promise.all([
                    Promise.resolve(data),
                    fetch(`${OPENDOTA_API_URL}/players/${playerId}/wl`).then(res => res.json())
                ]);
            })
            .then(([playerData, winLossData]) => {
                console.log('Win/loss data received:', winLossData);
                
                // Combine the data
                if (winLossData && (winLossData.win !== undefined || winLossData.lose !== undefined)) {
                    playerData.win_lose = winLossData;
                }
                
                displayPlayerInfo(playerData);
                
                console.log('Fetching recent matches for player:', playerId);
                return fetch(`${OPENDOTA_API_URL}/players/${playerId}/recentMatches`);
            })
            .then(response => {
                console.log('Recent matches API response status:', response.status);
                if (!response.ok) {
                    throw new Error(`Failed to fetch match history: ${response.status}`);
                }
                return response.json();
            })
            .then(matchData => {
                console.log('Match data received:', matchData);
                displayMatchHistory(matchData);
            })
            .catch(error => {
                console.error('Error in fetch operations:', error);
                displayError(`Error: ${error.message || 'Failed to fetch player data'}. Please try again or check the browser console for details.`);
            });
    }
    
    function displayPlayerInfo(playerData) {
        const { profile } = playerData;
        
        // Calculate win rate more accurately with better fallbacks
        let winRate = '0';
        let wins = 0;
        let losses = 0;
        let totalMatches = 0;
        
        if (playerData.win_lose) {
            wins = playerData.win_lose.win || 0;
            losses = playerData.win_lose.lose || 0;
            totalMatches = wins + losses;
            
            if (totalMatches > 0) {
                winRate = Math.round((wins / totalMatches) * 100);
            }
        }
        
        // Get MMR estimate with better fallback - improve numeric display
        let mmrDisplay = 'Uncalibrated';
        let mmrBadgeClass = '';
        let numericMmr = null;
        
        // First check for the numeric MMR values
        if (playerData.solo_competitive_rank) {
            numericMmr = parseInt(playerData.solo_competitive_rank);
            if (!isNaN(numericMmr)) {
                mmrDisplay = numericMmr.toLocaleString();
            }
        } else if (playerData.mmr_estimate && playerData.mmr_estimate.estimate) {
            numericMmr = parseInt(playerData.mmr_estimate.estimate);
            if (!isNaN(numericMmr)) {
                mmrDisplay = numericMmr.toLocaleString();
            }
        }
        
        // Then handle rank tier if available (which is more accurate)
        if (playerData.rank_tier) {
            // Convert Dota 2 rank tier to medal name
            const rankTier = playerData.rank_tier;
            const medal = Math.floor(rankTier / 10);
            const stars = rankTier % 10;
            
            const medalNames = [
                'Unranked', 
                'Herald', 
                'Guardian', 
                'Crusader', 
                'Archon', 
                'Legend', 
                'Ancient', 
                'Divine', 
                'Immortal'
            ];
            
            if (medal > 0 && medal < medalNames.length) {
                // FIXED: Show only medal name and stars WITHOUT estimated MMR
                mmrDisplay = `${medalNames[medal]} ${stars}`;
                
                // Set badge class based on rank
                if (medal >= 7) mmrBadgeClass = 'high-rank';
                else if (medal >= 4) mmrBadgeClass = 'mid-rank';
                else if (medal > 0) mmrBadgeClass = 'low-rank';
            }
        }
        
        // Create profile badge based on win rate
        let winRateBadgeClass = 'neutral';
        if (winRate >= 55) winRateBadgeClass = 'excellent';
        else if (winRate >= 50) winRateBadgeClass = 'good';
        else if (winRate > 0) winRateBadgeClass = 'poor';
        
        // FIXED: Simplified last match time display
        let lastMatchTime = 'Unknown';
        if (profile.last_match_time) {
            try {
                // Convert to a JavaScript Date object regardless of format
                let lastMatch;
                
                // Try different date formats
                if (typeof profile.last_match_time === 'string') {
                    // Handle ISO string format
                    lastMatch = new Date(profile.last_match_time);
                    
                    // If date is invalid, try parsing as timestamp
                    if (isNaN(lastMatch.getTime())) {
                        lastMatch = new Date(parseInt(profile.last_match_time) * 1000);
                    }
                } else if (typeof profile.last_match_time === 'number') {
                    // Handle unix timestamp (in seconds)
                    lastMatch = new Date(profile.last_match_time * 1000);
                }
                
                // Just display the date in a simple format
                if (lastMatch && !isNaN(lastMatch.getTime())) {
                    lastMatchTime = lastMatch.toLocaleDateString();
                } else {
                    console.error('Invalid date value:', profile.last_match_time);
                    lastMatchTime = 'Unknown date';
                }
            } catch (error) {
                console.error('Error formatting last match time:', error);
                lastMatchTime = 'Date error';
            }
        }

        // Show the matches header
        document.getElementById('matches-header').style.display = 'block';
        
        playerDetails.innerHTML = `
            <div class="player-header">
                <div class="player-avatar-container">
                    <img src="${profile.avatarfull || 'https://steamcdn-a.akamaihd.net/apps/dota2/images/blog/play/dota_hero_default.jpg'}" 
                        alt="${profile.personaname}" class="player-avatar">
                </div>
                <div class="player-identity">
                    <h2 class="player-name">${profile.personaname}</h2>
                    <div class="player-level ${mmrBadgeClass}">${mmrDisplay}</div>
                    <div class="player-links">
                        <a href="https://www.opendota.com/players/${playerData.profile.account_id}" target="_blank" class="player-link tooltip">
                            <i class="fas fa-chart-bar"></i> OpenDota
                            <span class="tooltip-text">View detailed stats on OpenDota</span>
                        </a>
                        <a href="${profile.profileurl}" target="_blank" class="player-link tooltip">
                            <i class="fab fa-steam"></i> Steam Profile
                            <span class="tooltip-text">Visit Steam profile</span>
                        </a>
                        <a href="https://www.dotabuff.com/players/${playerData.profile.account_id}" target="_blank" class="player-link tooltip">
                            <i class="fas fa-trophy"></i> Dotabuff
                            <span class="tooltip-text">View on Dotabuff</span>
                        </a>
                        ${profile.loccountrycode ? 
                            `<span class="player-country tooltip">
                                <i class="fas fa-globe"></i> ${profile.loccountrycode}
                                <span class="tooltip-text">Player location</span>
                             </span>` : ''}
                    </div>
                </div>
            </div>
            <div class="player-stats">
                <div class="stat-item">
                    <div class="stat-value ${winRateBadgeClass}">${winRate}%</div>
                    <div class="stat-label">Win Rate</div>
                    <div class="win-loss-bar">
                        <div class="win-bar" style="width: ${winRate}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalMatches.toLocaleString()}</div>
                    <div class="stat-label">Total Matches</div>
                    <div class="record-summary">
                        <span class="win-count">${wins.toLocaleString()}</span> - 
                        <span class="loss-count">${losses.toLocaleString()}</span>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${mmrDisplay}</div>
                    <div class="stat-label">Rank</div>
                </div>
                <div class="stat-item tooltip">
                    <div class="stat-value">${lastMatchTime}</div>
                    <div class="stat-label">Last Match</div>
                    <span class="tooltip-text">Last played match</span>
                </div>
            </div>
        `;
    }
    
    function displayMatchHistory(matches) {
        if (!matches || matches.length === 0) {
            matchesContainer.innerHTML = '<div class="error">No match history found</div>';
            return;
        }
        
        matchesContainer.innerHTML = '';
        
        matches.forEach(match => {
            const matchDate = new Date(match.start_time * 1000);
            const formattedDate = matchDate.toLocaleDateString();
            const formattedTime = matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const isWin = match.player_slot <= 127 ? match.radiant_win : !match.radiant_win;
            const kda = `${match.kills}/${match.deaths}/${match.assists}`;
            const minutes = Math.floor(match.duration / 60);
            const seconds = match.duration % 60;
            const formattedDuration = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            
            // Calculate KDA ratio
            const kdaRatio = ((match.kills + match.assists) / (match.deaths || 1)).toFixed(2);
            
            // Get hero data
            const hero = heroesData[match.hero_id];
            const heroName = hero ? hero.localized_name : 'Unknown Hero';
            
            // FIXED: Create hero image URL using the hero's in-game name
            let heroImageUrl = 'https://steamcdn-a.akamaihd.net/apps/dota2/images/blog/play/dota_hero_default.jpg'; // Default
            
            if (hero && hero.name) {
                // Extract just the hero name part
                const heroImgName = hero.name.replace('npc_dota_hero_', '');
                // Use the updated and more reliable URL format
                heroImageUrl = `https://cdn.dota2.com/apps/dota2/images/heroes/${heroImgName}_lg.png`;
            }
            
            // Determine match mode/type
            let matchType = 'Normal Match';
            if (match.lobby_type === 7) {
                matchType = 'Ranked';
            } else if (match.lobby_type === 0) {
                matchType = 'Normal';
            } else if (match.lobby_type === 2) {
                matchType = 'Tournament';
            }
            
            // Calculate GPM/XPM badge classes
            let gpmBadgeClass = '';
            if (match.gold_per_min >= 700) gpmBadgeClass = 'excellent';
            else if (match.gold_per_min >= 600) gpmBadgeClass = 'good';
            else if (match.gold_per_min >= 500) gpmBadgeClass = 'average';
            
            let xpmBadgeClass = '';
            if (match.xp_per_min >= 700) xpmBadgeClass = 'excellent';
            else if (match.xp_per_min >= 600) xpmBadgeClass = 'good';
            else if (match.xp_per_min >= 500) xpmBadgeClass = 'average';
            
            // KDA badge class
            let kdaBadgeClass = '';
            if (kdaRatio >= 5) kdaBadgeClass = 'excellent';
            else if (kdaRatio >= 3) kdaBadgeClass = 'good';
            else if (kdaRatio >= 2) kdaBadgeClass = 'average';
            
            const matchCard = document.createElement('div');
            matchCard.className = `match-card ${isWin ? 'win' : 'loss'}`;
            matchCard.dataset.matchId = match.match_id;
            
            matchCard.innerHTML = `
                <div class="match-result-indicator"></div>
                <img src="${heroImageUrl}" alt="${heroName}" class="hero-icon" 
                    onerror="this.src='https://steamcdn-a.akamaihd.net/apps/dota2/images/blog/play/dota_hero_default.jpg'">
                
                <div class="match-details">
                    <div class="match-info">
                        <div class="match-map">${heroName}</div>
                        <div class="match-date">
                            ${formattedDate} ${formattedTime} • ${matchType}
                        </div>
                    </div>
                    
                    <div class="match-stats">
                        <div class="match-result">${isWin ? 'Won' : 'Lost'}</div>
                        <div class="match-kd ${kdaBadgeClass}">
                            ${kda} <span class="kda-ratio">(${kdaRatio})</span>
                        </div>
                        <div class="match-economy">
                            <span class="gpm ${gpmBadgeClass}">${match.gold_per_min} GPM</span>
                            <span class="xpm ${xpmBadgeClass}">${match.xp_per_min} XPM</span>
                        </div>
                        <div class="match-duration">${formattedDuration}</div>
                    </div>
                </div>
            `;
            
            // Add click event to show match details
            matchCard.addEventListener('click', () => {
                showMatchDetails(match.match_id);
            });
            
            matchesContainer.appendChild(matchCard);
        });
    }
    
    function showMatchDetails(matchId) {
        // Show loading animation in modal
        modalContent.innerHTML = `
            <div class="loading">
                <div class="gem-loader"></div>
                <p>Loading match details...</p>
            </div>`;
        matchModal.style.display = 'block';
        
        // Fetch match details from OpenDota API
        fetch(`${OPENDOTA_API_URL}/matches/${matchId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch match details: ${response.status}`);
                }
                return response.json();
            })
            .then(matchDetails => {
                displayMatchDetails(matchDetails);
            })
            .catch(error => {
                console.error('Error fetching match details:', error);
                modalContent.innerHTML = `<div class="error">Failed to load match details: ${error.message}</div>`;
            });
    }
    
    function displayMatchDetails(match) {
        // Determine if radiant won
        const radiantWon = match.radiant_win;
        
        // Get match duration
        const hours = Math.floor(match.duration / 3600);
        const minutes = Math.floor((match.duration % 3600) / 60);
        const seconds = match.duration % 60;
        let formattedDuration = '';
        if (hours > 0) {
            formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Format match date
        const matchDate = new Date(match.start_time * 1000);
        const formattedDate = matchDate.toLocaleDateString();
        const formattedTime = matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Determine match mode
        let gameMode = 'Unknown';
        switch (match.game_mode) {
            case 1: gameMode = 'All Pick'; break;
            case 2: gameMode = 'Captains Mode'; break;
            case 3: gameMode = 'Random Draft'; break;
            case 4: gameMode = 'Single Draft'; break;
            case 5: gameMode = 'All Random'; break;
            case 22: gameMode = 'Ranked All Pick'; break;
            default: gameMode = 'Custom';
        }
        
        // Separate players by team
        const radiantPlayers = match.players.filter(player => player.player_slot < 128);
        const direPlayers = match.players.filter(player => player.player_slot >= 128);
        
        // Create a more compact match detail header
        let header = `
            <div class="match-detail-header">
                <div class="match-detail-title">Match #${match.match_id}</div>
                <div class="match-overview">
                    <div class="match-result-overview">
                        <span class="match-result-banner ${radiantWon ? 'victory' : 'defeat'}">
                            ${radiantWon ? 'Radiant Victory' : 'Dire Victory'}
                        </span>
                        <span class="match-date-info">${formattedDate}</span>
                    </div>
                    <div class="match-meta-info">
                        <span class="match-mode-badge">${gameMode}</span>
                        <span class="match-skill-badge">Skill: ${getSkillBracket(match.skill)}</span>
                        <span class="match-duration-badge">${formattedDuration}</span>
                    </div>
                </div>
            </div>
            
            <div class="match-statistics">
                <div class="stat-box radiant-stats">
                    <div class="stat-title">Radiant</div>
                    <div class="stat-number">${match.radiant_score || 0}</div>
                </div>
                <div class="stat-box dire-stats">
                    <div class="stat-title">Dire</div>
                    <div class="stat-number">${match.dire_score || 0}</div>
                </div>
                <div class="stat-box total-kills">
                    <div class="stat-title">Total Kills</div>
                    <div class="stat-number">${(match.radiant_score || 0) + (match.dire_score || 0)}</div>
                </div>
            </div>
            
            <div class="match-teams-container">
        `;
        
        // Build radiant team table
        header += `
            <div class="team-header radiant-header">Radiant Team${radiantWon ? ' (VICTORY)' : ''}</div>
            <div class="team-players radiant-players">
        `;
        
        // Add radiant players
        header += buildPlayersTable(radiantPlayers);
        
        // Build dire team table
        header += `
            </div>
            <div class="team-header dire-header">Dire Team${!radiantWon ? ' (VICTORY)' : ''}</div>
            <div class="team-players dire-players">
        `;
        
        // Add dire players
        header += buildPlayersTable(direPlayers);
        
        header += '</div></div>';
        
        modalContent.innerHTML = header;
    }
    
    // Update buildPlayersTable for a more compact display
    function buildPlayersTable(players) {
        let html = '';
        
        players.forEach(player => {
            // Get hero data
            const hero = heroesData[player.hero_id] || { localized_name: 'Unknown Hero' };
            const heroName = hero.localized_name;
            
            // Create hero image URL with safer handling
            let heroImageUrl;
            if (hero && hero.name) {
                // Extract hero name without prefix
                const heroImgName = hero.name.replace('npc_dota_hero_', '');
                // Use the correct CDN endpoint that works with hero images
                heroImageUrl = `https://cdn.dota2.com/apps/dota2/images/heroes/${heroImgName}_sb.png`;
            } else {
                // Fallback to default hero image
                heroImageUrl = 'https://steamcdn-a.akamaihd.net/apps/dota2/images/blog/play/dota_hero_default.jpg';
            }
            
            // Calculate KDA ratio
            const kdaRatio = ((player.kills + player.assists) / (player.deaths || 1)).toFixed(2);
            
            // Check if this is the current player
            const isCurrentPlayer = player.account_id == currentPlayerId;
            
            // Create player row with badges for KDA
            const kdaValue = player.kills + player.assists;
            let kdaBadgeClass = '';
            if (kdaValue >= 20) kdaBadgeClass = 'excellent';
            else if (kdaValue >= 15) kdaBadgeClass = 'good';
            else if (kdaValue >= 10) kdaBadgeClass = 'average';
            
            // Add badges for GPM/XPM
            let gpmClass = '';
            if (player.gold_per_min >= 700) gpmClass = 'excellent';
            else if (player.gold_per_min >= 600) gpmClass = 'good';
            else if (player.gold_per_min >= 500) gpmClass = 'average';
            
            let xpmClass = '';
            if (player.xp_per_min >= 700) xpmClass = 'excellent';
            else if (player.xp_per_min >= 600) xpmClass = 'good';
            else if (player.xp_per_min >= 500) xpmClass = 'average';
            
            // Improved player row layout
            html += `
                <div class="player-row ${isCurrentPlayer ? 'current-player' : ''}">
                    <div class="player-hero-info">
                        <img src="${heroImageUrl}" alt="${heroName}" class="player-hero-icon" 
                            onerror="this.src='https://steamcdn-a.akamaihd.net/apps/dota2/images/blog/play/dota_hero_default.jpg'">
                        <div class="player-name-container">
                            <div class="player-name">${player.personaname || 'Anonymous'}</div>
                            <div class="hero-name">${heroName}</div>
                        </div>
                    </div>
                    
                    <div class="player-stats-items">
                        <div class="player-stats-compact">
                            <div class="stat-group ${kdaBadgeClass}">
                                <div class="stat-value">${player.kills}/${player.deaths}/${player.assists}</div>
                                <div class="stat-label">K/D/A</div>
                            </div>
                            
                            <div class="stat-group">
                                <div class="stat-value">${player.last_hits || 0}/${player.denies || 0}</div>
                                <div class="stat-label">LH/DN</div>
                            </div>
                            
                            <div class="stat-group ${gpmClass}">
                                <div class="stat-value">${player.gold_per_min || 0}</div>
                                <div class="stat-label">GPM</div>
                            </div>
                            
                            <div class="stat-group ${xpmClass}">
                                <div class="stat-value">${player.xp_per_min || 0}</div>
                                <div class="stat-label">XPM</div>
                            </div>
                        </div>
                        
                        <div class="player-items">
                            <div class="item-icons">
                                ${getItemsHtml(player)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    function getItemsHtml(player) {
        // Item slots (0-5 are main items)
        let itemsHtml = '';
        
        // Make sure itemsData is available
        if (!itemsData || Object.keys(itemsData).length === 0) {
            return '<div class="error">Item data not loaded</div>';
        }
        
        // Main items
        for (let i = 0; i < 6; i++) {
            const itemId = player[`item_${i}`];
            if (itemId && itemId !== 0) {
                // Try to get item name
                const itemKey = getItemNameById(itemId);
                const item = itemKey ? itemsData[itemKey] : null;
                const itemName = item ? item.dname : `Item ${itemId}`;
                
                // Create image URL with fallback handling
                let itemImg = '';
                if (itemKey) {
                    itemImg = `https://steamcdn-a.akamaihd.net/apps/dota2/images/items/${itemKey}_lg.png`;
                }
                
                itemsHtml += `
                    <img src="${itemImg}" alt="${itemName}" title="${itemName}" class="item-icon" 
                        onerror="this.src='https://steamcdn-a.akamaihd.net/apps/dota2/images/items/emptyitembg.png'">
                `;
            } else {
                // Empty slot with better styling
                itemsHtml += `
                    <div class="item-icon empty-item"></div>
                `;
            }
        }
        
        return itemsHtml;
    }
    
    function getItemNameById(itemId) {
        // This is a simple mapping function as the itemsData uses string names
        for (const itemName in itemsData) {
            if (itemsData[itemName].id === itemId) {
                return itemName;
            }
        }
        return null;
    }
    
    function getSkillBracket(skill) {
        switch (skill) {
            case 1: return 'Normal';
            case 2: return 'High';
            case 3: return 'Very High';
            default: return 'Unknown';
        }
    }
    
    // -- Improve error display function for better feedback --
    function displayError(message) {
        playerDetails.innerHTML = `<div class="error">${message}</div>`;
    }

    // Video background error handling
    const backgroundVideo = document.getElementById('background-video');
    const videoBackground = document.querySelector('.video-background');
    
    // Check if the video loads properly
    let videoLoadTimeout;
    let videoLoaded = false;
    
    // Function to handle video loading error
    function handleVideoError() {
        if (!videoLoaded) {
            console.log('Video failed to load, switching to fallback image');
            videoBackground.classList.add('video-error');
        }
    }
    
    // Set timeout to check if video is actually loading
    videoLoadTimeout = setTimeout(handleVideoError, 5000); // 5 seconds timeout
    
    // If video plays successfully, clear the timeout and mark as loaded
    backgroundVideo.addEventListener('playing', () => {
        videoLoaded = true;
        clearTimeout(videoLoadTimeout);
        console.log('Video background playing successfully');
    });
    
    // If there's an error on the video or any source, handle it
    backgroundVideo.addEventListener('error', () => {
        handleVideoError();
    });
    
    // Add error handling for each source element
    const videoSources = backgroundVideo.querySelectorAll('source');
    videoSources.forEach(source => {
        source.addEventListener('error', () => {
            console.log(`Error loading video source: ${source.src}`);
        });
    });
});

