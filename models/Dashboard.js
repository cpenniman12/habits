const supabase = require('../services/supabaseClient');

/**
 * Get all active challenges with their current streaks and completion history
 */
exports.getActiveStreaks = async () => {
  try {
    // Query for active challenges and join with users table to get emails
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        id,
        habit_description,
        initiator_streak,
        friend_streak,
        start_date,
        initiator:initiator_id(id, email),
        friend:friend_id(id, email)
      `)
      .eq('status', 'active')
      .order('start_date', { ascending: false });
    
    if (error) throw error;
    
    // Fetch completions data for each challenge and user
    const enhancedData = await Promise.all(data.map(async (challenge) => {
      // Get habit completions for initiator
      const { data: initiatorCompletions, error: initiatorError } = await supabase
        .from('habit_completions')
        .select('completion_date')
        .eq('challenge_id', challenge.id)
        .eq('user_id', challenge.initiator.id)
        .order('completion_date', { ascending: true });
        
      if (initiatorError) throw initiatorError;
      
      // Get habit completions for friend
      const { data: friendCompletions, error: friendError } = await supabase
        .from('habit_completions')
        .select('completion_date')
        .eq('challenge_id', challenge.id)
        .eq('user_id', challenge.friend.id)
        .order('completion_date', { ascending: true });
        
      if (friendError) throw friendError;
      
      // Calculate day indices for each completion (0-17 for 18 day period)
      const initiatorDayIndices = calculateDayIndices(initiatorCompletions, challenge.start_date);
      const friendDayIndices = calculateDayIndices(friendCompletions, challenge.start_date);
      
      return {
        id: challenge.id,
        habitDescription: challenge.habit_description,
        initiatorEmail: challenge.initiator.email,
        friendEmail: challenge.friend.email,
        initiatorStreak: challenge.initiator_streak, // Keep for backward compatibility
        friendStreak: challenge.friend_streak, // Keep for backward compatibility
        startDate: new Date(challenge.start_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        // Add the completion data as day indices (0-17)
        initiatorCompletions: initiatorDayIndices,
        friendCompletions: friendDayIndices
      };
    }));
    
    return enhancedData;
  } catch (error) {
    console.error('Error fetching active streaks:', error);
    throw error;
  }
};

/**
 * Calculate day indices (0-17) from completion dates relative to challenge start date
 * @param {Array} completions - Array of completion records
 * @param {String} startDateStr - Start date of the challenge as ISO string
 * @returns {Array} - Array of day indices (0-17) that are completed
 */
function calculateDayIndices(completions, startDateStr) {
  if (!completions || !startDateStr) return [];
  
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0); // Normalize to start of day
  
  return completions
    .map(completion => {
      const completionDate = new Date(completion.completion_date);
      completionDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Calculate days difference
      const diffTime = completionDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Return day index if within 18-day window
      return diffDays >= 0 && diffDays < 18 ? diffDays : null;
    })
    .filter(index => index !== null); // Remove any out-of-range indices
}

/**
 * Get top 5 longest current streaks
 * This is kept for backward compatibility but could be removed or updated
 * to use habit_completions data instead
 */
exports.getTopStreaks = async () => {
  try {
    // Get all active challenges
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select(`
        id,
        habit_description,
        initiator_streak,
        friend_streak,
        initiator:initiator_id(id, email),
        friend:friend_id(id, email)
      `)
      .eq('status', 'active');
    
    if (error) throw error;
    
    // Create a flat array of all streaks
    const allStreaks = [];
    
    challenges.forEach(challenge => {
      // Add initiator streak
      allStreaks.push({
        id: challenge.id,
        habitDescription: challenge.habit_description,
        userEmail: challenge.initiator.email,
        streak: challenge.initiator_streak,
        isInitiator: true
      });
      
      // Add friend streak
      allStreaks.push({
        id: challenge.id,
        habitDescription: challenge.habit_description,
        userEmail: challenge.friend.email,
        streak: challenge.friend_streak,
        isInitiator: false
      });
    });
    
    // Sort by streak count (descending) and take top 5
    return allStreaks
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5);
      
  } catch (error) {
    console.error('Error fetching top streaks:', error);
    throw error;
  }
};
