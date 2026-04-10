const git = require('child_process');
const fs = require('fs');
const g = git.execSync(
  'git show HEAD:skills/xiage-skills/xiage-skills.js',
  {cwd:'C:/Users/Administrator/.openclaw/workspace', encoding:'utf8'}
);

const fbMarker = "info('Puppeteer failed, falling back to ZIP'";
const fbIdx = g.indexOf(fbMarker);
console.log('ZIP fallback starts at:', fbIdx);

// The closing section of installSingleSkill (found earlier)
const issEnd = 33736;
const closingSection = g.substring(issEnd - 60, issEnd);
console.log('Closing section:', JSON.stringify(closingSection));

// The old ZIP block is from fbIdx to the last '    });' before the function end
// The installSingleSkill closes with:
//     });    ← closes Promise
// }           ← closes function
// So the closing section is:
//     });\n}
// Which is 4 chars + 2 chars = 6 chars... no, the closing section is:
// '    });\n}\n\n' from the context
// The closing section is '    });\n}\n'
// And we found issEnd = 33736

// The OLD ZIP block ends at: issEnd - 4 (for '    })') - 2 (for '\n}') - 1 (for newline before closing section)
// Actually issEnd = first character of the closing '}'
// The closing '}' is at issEnd-1 (for '\n}') or issEnd-2 for '}\n}'
// From the context: issEnd closes at character 33736, and the closing section starts from '    });\n}\n\n'


// The closing section starts at: issEnd - '    });\n}\n'.length
const closingStr = '    });\n}\n\n';
const closingStart = issEnd - closingStr.length;
console.log('Closing section starts at:', closingStart, 'Content:', JSON.stringify(g.substring(closingStart, issEnd + 10)));

// The old ZIP block = from fbIdx to closingStart
const oldZip = g.substring(fbIdx, closingStart);
console.log('\nOld ZIP block length:', oldZip.length);
console.log('Start:', JSON.stringify(oldZip.slice(0, 100)));
console.log('End:', JSON.stringify(oldZip.slice(-100)));

// Verify: the end should be 'zipUrl...' without any closing '})'
console.log('Old ZIP ends with:', JSON.stringify(oldZip.slice(-50)));

// Now write this old block to a file so we can use it in the fix
fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/old_zip_block.txt', oldZip, 'utf8');
console.log('\nOld ZIP block saved to old_zip_block.txt');
