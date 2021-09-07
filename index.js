/********** GLOBAL: CREATE APP, WEB CLIENT, INTERACTIVE ABILITY **********/ 
const { App } = require('@slack/bolt');
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  endpoints: {
     events: '/slack/events',
     commands: '/slack/commands' 
   }
});
/* 
//add modal dialog boxes later
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackInteractions = createMessageAdapter(slackSigningSecret);
*/

/********** GLOBAL VARIABLES FROM ENVIRONMENT SETTINGS **********/ 
const token = process.env.SLACK_BOT_TOKEN;
const primaryChannel = process.env.SLACK_PRIMARY_CHANNEL;
const sandboxChannel = process.env.SLACK_SANDBOX_CHANNEL;
const hourStartWorkDay = process.env.START_WORKDAY_HOUR;
const hourEndWorkDay = process.env.END_WORKDAY_HOUR;
const filenameMuteIdList = 'muteid.txt';

/********** GLOBAL VARIABLES **********/
const { WebClient, LogLevel } = require('@slack/web-api');
const web = new WebClient(token);
var membersPrimaryChannel = [];

/**********FUNCTIONS **********/

// getMuteList: read list of uids from the 'muteid.txt' 
// return list of muted userids in array
function getMuteList()
{
  var fs = require('fs');
  var returnMuteArray = [];
  
  try {
    
    if (fs.existsSync(filenameMuteIdList)) 
    {
      returnMuteArray = fs.readFileSync(filenameMuteIdList, 'utf8').split('\n');
    }
  } catch(err) {
    console.error(err)
  };
  return returnMuteArray;
};

// isOnMuteList: check if the userid passed is on the mute list
// returns true/false if the userid is on the mute list
function isOnMuteList( userid )
{
  var isOn = false;
  var loopMute = 0;
  var muteList = getMuteList();
  
  //console.log('muteList.length =  '+muteList.length);
  for ( loopMute = 0; loopMute < muteList.length; loopMute++ )
  {
    //console.log('eval: '+muteList[loopMute]+' = '+userid+' ?');
    if ( muteList[loopMute] == userid )
    {
      isOn = true;
    }
  }
  return isOn;
};

function doMuteList( userId )
{
  var muteArray = [];
  var newMuteArray = [];
  var loopMute = 0;
  var loopArray = 0;
  var fs = require('fs');
  var stringEntry = '';
  var returnDoMuteMList = '';
  
  muteArray = getMuteList();
  
  if ( isOnMuteList( userId ) == true )
  {
    // userid is already on the list, assume they want off the list
    for ( loopMute = 0; loopMute < muteArray.length; loopMute++ )
    {
      // re-do the array with all ids except the one being removed
      if ( muteArray[loopMute] != userId )
      {
        newMuteArray.push( muteArray[loopMute] );
      };
    }
    returnDoMuteMList = 'You have been removed from the StatusBot mute list. Use /statusmute if you wish to be back on the mute list.';
  }
  else
  {
    // take the list of currently muted ids, add this id to it
    newMuteArray = muteArray;
    newMuteArray.push( userId );
    returnDoMuteMList = 'You have been added to StatusBot mute list. Use /statusmute if you wish to be removed from the mute list.';
  }
  // delete the current mute list file
  fs.unlink(filenameMuteIdList, (err) => {
    if (err) {
      console.error(err)
      return
    }
  })
  // create a new mute list file
  fs.writeFile(filenameMuteIdList, '', (err) => {
    if (err) {
      console.error(err)
      return
    }
  })
  // put the muted ids into the mutelist file
  for ( loopArray = 0; loopArray < newMuteArray.length; loopArray++ )
  {
    if ( newMuteArray[loopArray].length > 1 ) //bug: was adding empty lines to muteid.txt file, possibly b/c sync issues? this fixes.
    {
      fs.appendFile(filenameMuteIdList, newMuteArray[loopArray]+'\n', (err) => { 
        
        if (err) 
          console.log(err); 
        else 
          console.log('file written');
      }); 
    }
  }
  return returnDoMuteMList;
};

// getFirstName: assumes string passed is a full name and
// returns first name
function getFirstName( anyName )
{
  var firstSpace = 0;
  var returnName = '';
  
  firstSpace = anyName.indexOf(' ');
  
  if (firstSpace > 1)
    returnName = anyName.substring(0, firstSpace);
  else
    returnName = anyName;
  //console.log('getFirstName = '+ returnName);
  return returnName;
};

// isInArray: passed a channel/conversation member list and a uid, 
// return true/false if uid is in that list
function isInArray( channelMembers, userId )
{
  var iCount = 0;
  console.log('userid to check = ' + userId);
  console.log('channelMember.length = ' + channelMembers.length);
  
  if ( Array.isArray( channelMembers ) == false ) 
  {
    console.log('isInArray: not an array');
    return false;
  }
  
  for ( iCount = 0; iCount < channelMembers.length; iCount++ )
  {
    //console.log('channel member = ' + channelMembers[iCount]);
    if ( channelMembers[iCount] == userId  )
    {
      //console.log('isInArray=true');
      return true;
    }
  }
  //console.log('isInArray: false (' + userId + ')');
  return false;
};

// userIsBot: passed a user id
// returns true/false if the userid is for a bot
async function userIsBot( userId )
{
  const isBotResult = await app.client.users.info({
        token: process.env.SLACK_ACCESS_TOKEN,
        user: userId,
  });
  
  if ( isBotResult.user.is_bot == true )
  {
    return true; 
  }
  else
  {
    return false;
  }
};

async function getCurrentUserEmail()
{
  var returnEmail = '';
  
  try {
    const emailResult = await app.client.users.profile.get({
      token: process.env.SLACK_ACCESS_TOKEN
    })
    //console.log(emailResult.profile.email);
    returnEmail = emailResult.profile.email;
    
  } catch(error){
    // more error handling?
  };
  return returnEmail;
};

async function getCurrentUserId()
{
  var userEmail = '';
  var returnId = '';
  
  userEmail = await getCurrentUserEmail();
  
  try {
     const userIdResult = await app.client.users.lookupByEmail({
      token: process.env.SLACK_ACCESS_TOKEN,
      email: userEmail
    });
    console.log(userIdResult.user.id);
    returnId = userIdResult.user.id;
  } catch(error) {
    // more error handling?
  };
  return returnId;
};

// fetchUsers: finds the users of the channel specified in env variables as primary
// filters out bot and muted users, puts all others into global variable array
async function fetchUsers()
{
  //membersPrimaryChannel = [];
  
  var loopOne = 0;
  var isBotUser = false;
  var isMuted = false;
  
  try {
    
    const resultOne = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: primaryChannel
    });
    
    for ( loopOne = 0; loopOne < resultOne.members.length; loopOne++ )
    {      
      isBotUser = await userIsBot( resultOne.members[loopOne] );
      isMuted = await isOnMuteList( resultOne.members[loopOne] );
      
      if ( ( isBotUser == false ) && (  isMuted == false ) )
      {
        membersPrimaryChannel.push(resultOne.members[loopOne]);
      }
      else
      {
        
        if ( isBotUser == true )
        {
          //console.log('bot: ' + resultOne.members[loopOne]);
        };
        
        if ( isMuted == true )
        {
          console.log('muted: ' + resultOne.members[loopOne]);
        };
      }
    }
  }
  catch (error) {
    console.error(error);
  };
  console.log('fetchUsers = ' + membersPrimaryChannel.length);
};

// getHour: returns the current hour for EST time by default
// use parameter to get offset from UTC
// note: admiteddly this is inelegant 
function getHour( offSet )
{
  var d = new Date();
  
  if ( offSet != '' )
    return (d.getHours() - 5);
  else
    return (d.getHours() + offSet);
};

// getUserDisplayName: passed a userid 
// returns Slack's full name for that user
async function getUserDisplayName( userId )
{
  var returnName = '';
  try {
    const displayNameResult = await app.client.users.info({
        token: process.env.SLACK_ACCESS_TOKEN,
        user: userId,
    });
    console.log('getUDisName = ' + displayNameResult.user.real_name);
    returnName = displayNameResult.user.real_name;
  } catch (error) {
    console.log(error);
  };
  return returnName;
};

// getUserPresence: passed a userid
// returns Slack's presence for that user (either 'active' or 'away')
async function getUserPresence( userId )
{
  var returnPres = '';
  try {
    const presenceResult = await app.client.users.getPresence({
        token: process.env.SLACK_ACCESS_TOKEN,
        user: userId,
    });
    console.log('getUserPresence = ' + presenceResult.presence);
    returnPres = presenceResult.presence;
  } catch (error){
    console.log(error);
  }
  return returnPres;
};

async function messageUser( userId, messageToSend )
{
  
  if ( userId == '' | userId.length == undefined )
  {
    console.log('messageUser invalid userId parameter');
    return;
  }
  try {
    const result = await app.client.chat.postMessage({
      token: token,
      channel: userId,
      text: messageToSend
    });
  } catch(error){
      console.log(error);
  };
  return;
};

// ******* SLACK APP SLASH COMMANDS *******
// MUST BE CONFIGURED IN SLACK APP INTERFACE AND CODED HERE

// slack app event: slash command /statusbot tells the user
// what its supported slash commands are
app.command('/statusbot', async ({ command, ack, say }) => {
  
  if ( command.text == '' )
  {
      say('\n\nCommands:\n\n/statuslist\n/statusmute\n');
  }
  else
  {
    await say('Unknown: ' + `${command.text}`);
  } 
}); 

// slack slash command: displays the full names of channel/conversation
// users, in two groups, Active and Inactive 
// to do: add 3rd section to show names of those on muted list
app.command('/statuslist', async ({ command, ack, say }) => {
  var utility = 0;
  var uName = '';
  var countActive = 0;
  var countAway = 0;
  var sSayMsg = '';
  var sayActiveMsg = '*Active:*\n';
  var sayAwayMsg = '*Away:*\n';
  var sPres = '';
  var sError = '';
  
  await ack();
  
  for ( utility = 0; utility < membersPrimaryChannel.length; utility++ )
  {
    sPres = await getUserPresence(membersPrimaryChannel[utility]); 
    uName = await getUserDisplayName(membersPrimaryChannel[utility]);
    
    switch ( sPres )
    {
      case 'active':
        countActive++;
        sayActiveMsg += uName + '\n';
        break;
      case 'away':
        countAway++;
        sayAwayMsg += uName + '\n'
        break;
      default:
        sError = 'error:'+ membersPrimaryChannel[utility];
        break;
    };
  }
  sSayMsg = 'There are ' + countActive + ' Active and ' + countAway + ' Away users.\n'+ sayActiveMsg + sayAwayMsg;
  await say( sSayMsg );
}); // end command statuslist

// slack slash command: mute the current user so status bot
// does not report on their status to the group; same command
// will un-mute the current user if already on the muted list
app.command('/statusmute', async ({ command, ack, say }) => {
  var userMuted = false;
  var resultDoAction = '';
  var userId = '';
   
  await ack();
  
  if ( command.text.length > 1 )
  {
    userId = command.text;
  }
  else
  {
    userId = await getCurrentUserId();
  }
  
  resultDoAction = doMuteList( userId );
  
  //await say(resultDoAction);
  
  await messageUser( userId, resultDoAction );
  
  console.log('statusmute = '+resultDoAction);
}); // end command statusmute

// slack slash command: schedule a direct message 
// this is currently half baked - I don't have it working yet
app.command('/schedule_dm', async ({ command, ack, say }) => {
  var utility = 0;
  var commText = '';
  var sayMsg = '';
  var paramHours = 0;
  var paramMsg;
  await ack();
  var end = 0;
  var recipient = '';
  
  console.log('command.user_id='+command.user_id);
  
  if ( command.text == '' )
  {
    await say('usage: /schedule_dm [@recipient] [hours_to_wait] [msg_to_send]');
  }
  else
  {
    commText = command.text;
    console.log('commText = ' + commText);
    
    if ( commText[0] == '@' )
    {
        //console.log('found @');
      end = commText.indexOf(' ');
      recipient = commText.substring(0, end);
      console.log('found: '+recipient);
      commText = commText.substring(end+1,commText.length);
      end = commText.indexOf(' ');
      
      if ( 1 == 1 )
      {
        // nothing
      }
    }
    else
    {
      await say('usage: /schedule_dm [@recipient] [hours_to_wait] [msg_to_send]');
    }
  }
}); // reminder: this command has untested code that doesn't work
// end command qa_schedule_dm

/********** APP EVENTS **********/

// app_mention handles when the user cites the bot directly
// currently the bot has replies if there's hi or hello in the message
// or not, or if the message was received in a channel that is not
// specified in the env variables for primary and sandbox
app.event('app_mention', async ({ event, say }) => {  
  const {text, user, channel} = event;
  var respond_id = '';
  respond_id = user;
  var r_name = '';
  var responseMsg = '';
  var boolMsg = false;
  
  const emailResult = await app.client.users.profile.get({
    token: process.env.SLACK_ACCESS_TOKEN
  });
  r_name = await getFirstName( emailResult.profile.real_name );
  console.log('respond_id='+respond_id+',name='+r_name);
  //console.log(emailResult.profile.real_name);
  
  if ( channel == primaryChannel || channel == sandboxChannel )
  { 
    
    if ( ((/hi/i.test(text) == true) || (/hello/i.test(text) == true)) )
    {
      responseMsg = responseMsg + 'Hello ' + r_name + '!';
      boolMsg = true;
    }
    
    if ( /how\sare\syou?/i.test(text) == true )  
    {
      responseMsg = responseMsg + 'I am doing well. ';
      boolMsg = true;
    }
    
    if ( boolMsg == false )
    {
      responseMsg = 'I do not understand.';
    }
    else
    {
      console.log('msg='+responseMsg);
      await say( responseMsg );
    }
  }
  else 
  {
      await say('echo: <@'+ user +'>, text:(' + text + ')' + ', channel:' + channel + '.');
  }  
});

// if a user changes status, this event is fired. if the user making the user change
// is in the primary work group (not on muted list), and this change is during the hours
// in the env variables, the event will be echoed by the bot to the group
app.event('user_change', async ({ event, client }) => {  

  var presence = '';
  var statusChangeMsg = '';
  var wfhChangeMsg = ''; 
  var thisHour = getHour();
  var name = '';
    
  presence = await getUserPresence( event.user.id );
  
  if ( presence == 'active' )
  {

    if ( isInArray( membersPrimaryChannel, event.user.id ) == true )
    {
      
      if (( thisHour >= hourStartWorkDay && thisHour <= hourEndWorkDay ))
      {
        name = await getUserDisplayName( event.user.id );
        name = getFirstName( name );
        
        if ( event.user.profile.status_text.length > 0 )
        {
          statusChangeMsg = name + ': ' +  event.user.profile.status_text + ' ' + event.user.profile.status_emoji;
        }
        else
        {
          statusChangeMsg = name + ': ' + presence;
        }
        (async () => {

          try {
                const result = await web.chat.postMessage({
                  text: statusChangeMsg,
                  channel: primaryChannel,
                  });      
          } 
         catch (error) {
            console.error(error);
          }
        })(); 
      }
      else
      {  
        console.log('user_change before/after hours');
      }
    }
  }; 
});

/**********APP ERROR HANDLING**********/
app.error((error) => {
	// todo: more detailed error handling
	console.error(error);
});

/********** MAIN APP START **********/
(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');

    if ( await web.auth.test() )
    {
      console.log('Bot connected to Slack workspace');
    }
  }
  catch (error) {
    console.error(error);
  }
  fetchUsers();
  
})(); // end MAIN