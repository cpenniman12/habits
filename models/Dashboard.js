const supabase = require('../services/supabaseClient');

/**
 * Get all active challenges with their current streaks
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
    
    // Fetch streak history data if available
    const enhancedData = await Promise.all(data.map(async (challenge) => {
      // Try to get streak history for initiator
      const { data: initiatorHistory } = await supabase
        .from('streak_history')
        .select('history')
        .eq('challenge_id', challenge.id)
        .eq('user_id', challenge.initiator_id)
        .single();
      
      // Try to get streak history for friend
      const { data: friendHistory } = await supabase
        .from('streak_history')
        .select('history')
        .eq('challenge_id', challenge.id)
        .eq('user_id', challenge.friend_id)
        .single();
      
      return {
        id: challenge.id,
        habitDescription: challenge.habit_description,
        initiatorEmail: challenge.initiator.email,
        friendEmail: challenge.friend.email,
        initiatorStreak: challenge.initiator_streak,
        friendStreak: challenge.friend_streak,
        startDate: new Date(challenge.start_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        initiatorHistory: initiatorHistory?.history || [],
        friendHistory: friendHistory?.history || []
      };
    }));
    
    return enhancedData;
  } catch (error) {
    console.error('Error fetching active streaks:', error);
    throw error;
  }
};

/**
 * Get top 5 longest current streaks
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
