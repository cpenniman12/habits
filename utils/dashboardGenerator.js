/**
 * Generates an SVG visualization of habit completions
 * @param {Array} challenges - Array of challenge objects with user data and completions
 * @returns {String} - SVG markup as a string
 */
function generateDashboardSVG(challenges) {
  if (!challenges || challenges.length === 0) {
    return '';
  }

  // Color mappings for different habit types
  const colorSchemes = [
    { bg: '#e3f2fd', fill: '#64b5f6' }, // Blue
    { bg: '#e8f5e9', fill: '#81c784' }, // Green
    { bg: '#f8eae8', fill: '#f48fb1' }, // Pink
    { bg: '#e0f7fa', fill: '#4fc3f7' }, // Light Blue
    { bg: '#fff8e1', fill: '#ffd54f' }, // Yellow
    { bg: '#f3e5f5', fill: '#ce93d8' }  // Purple
  ];

  // Calculate total height based on number of challenges and users
  const challengeHeight = 150;
  const totalHeight = challenges.reduce((height, challenge) => {
    // Count initiator and friend (2 users per challenge)
    return height + challengeHeight;
  }, 20);

  // Start building the SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${totalHeight}">
  <!-- Background -->
  <rect width="400" height="${totalHeight}" fill="#f8f9fa" rx="0" ry="0" />
  `;

  // Track vertical position
  let yPosition = 20;

  // Loop through challenges and generate groups for each
  challenges.forEach((challenge, index) => {
    const colorScheme = colorSchemes[index % colorSchemes.length];
    
    // Extract data
    const habitName = challenge.habitDescription;
    const initiator = {
      email: challenge.initiatorEmail,
      completions: challenge.initiatorCompletions || []
    };
    const friend = {
      email: challenge.friendEmail,
      completions: challenge.friendCompletions || []
    };

    // Add habit group
    svg += `
  <!-- ${habitName} Habit Group -->
  <g transform="translate(0, ${yPosition})">
    <!-- Habit Label -->
    <rect x="20" y="10" width="360" height="30" rx="4" ry="4" fill="${colorScheme.bg}" />
    <text x="200" y="30" font-family="Arial, sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#2c3e50">${habitName}</text>
    
    <!-- User 1: ${initiator.email} -->
    <g transform="translate(0, 50)">
      <!-- User Label -->
      <text x="20" y="15" font-family="Arial, sans-serif" font-size="14" fill="#555555">${truncateEmail(initiator.email)}</text>
      
      <!-- Progress Bar Background -->
      <rect x="20" y="25" width="360" height="20" rx="4" ry="4" fill="${colorScheme.bg}" />
      
      <!-- Progress Markers - 18 segments -->
      <g>
        ${generateProgressMarkers(initiator.completions, colorScheme)}
      </g>
    </g>
    
    <!-- User 2: ${friend.email} -->
    <g transform="translate(0, 100)">
      <!-- User Label -->
      <text x="20" y="15" font-family="Arial, sans-serif" font-size="14" fill="#555555">${truncateEmail(friend.email)}</text>
      
      <!-- Progress Bar Background -->
      <rect x="20" y="25" width="360" height="20" rx="4" ry="4" fill="${colorScheme.bg}" />
      
      <!-- Progress Markers - 18 segments -->
      <g>
        ${generateProgressMarkers(friend.completions, colorScheme)}
      </g>
    </g>
  </g>`;

    // Update y position for next habit group
    yPosition += challengeHeight;
  });

  // Close SVG
  svg += `
</svg>`;

  return svg;
}

/**
 * Generate progress markers for the 18-day streak visualization
 * @param {Array} completedIndices - Array of day indices (0-17) that have been completed
 * @param {Object} colorScheme - Object with bg and fill colors
 * @returns {String} - SVG markup for progress markers
 */
function generateProgressMarkers(completedIndices, colorScheme) {
  let markers = '';
  
  for (let i = 0; i < 18; i++) {
    const x = 20 + (i * 20);
    const completed = completedIndices.includes(i);
    
    if (completed) {
      markers += `
        <rect x="${x}" y="25" width="20" height="20" fill="${colorScheme.fill}" />`;
    } else {
      markers += `
        <rect x="${x}" y="25" width="20" height="20" fill="${colorScheme.bg}" stroke="#ccd9e0" stroke-width="1" />`;
    }
  }
  
  return markers;
}

/**
 * Truncate email if it's too long for display
 * @param {String} email - Email address
 * @returns {String} - Truncated email for display
 */
function truncateEmail(email) {
  if (email.length > 25) {
    return email.substring(0, 22) + '...';
  }
  return email;
}

module.exports = {
  generateDashboardSVG
};
