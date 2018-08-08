var $ = jQuery = require('jquery');
var _ = require('lodash');
var M = require('materialize-css');
var fs = eRequire('fs');

var electron = eRequire('electron');
var ipc = electron.ipcRenderer;

var currentFile = '';

var React = require('react');
var ReactDOM = require('react-dom');
var TeamListEntry = require('./TeamListEntry');
var GameListEntry = require('./GameListEntry');
//var Toolbar = require('./Toolbar');
var HeaderNav = require('./HeaderNav');
var AddTeamModal = require('./AddTeamModal');
var AddGameModal = require('./AddGameModal');
var TeamList = require('./TeamList');
var GameList = require('./GameList');
var StatSidebar = require('./StatSidebar');

//skip players1, players2 because comparing objects is more complicated and I'm lazy
function gameEqual(g1, g2) {
  if((g1 == undefined && g2 != undefined) || (g1 != undefined && g2 == undefined)) {
    return false;
  }
  return g1.round == g2.round && g1.tuhtot == g2.tuhtot &&
    g1.ottu == g2.ottu && g1.forfeit == g2.forfeit && g1.team1 == g2.team1 &&
    g1.team2 == g2.team2 && g1.score1 == g2.score1 && g1.score2 == g2.score2 &&
    g1.notes == g2.notes;
}

function getSmallStandings(myTeams,myGames) {
  var summary = myTeams.map(function(item, index) {
    var obj =
      { teamName: item.teamName,
        wins: 0,
        losses: 0,
        ties: 0,
        points: 0,
        bHeard: 0,
        bPts: 0,
        forfeits: 0,
      };
    return obj;
  }); //map
  for(var i in myGames) {
    var g = myGames[i];
    var idx1 = _.findIndex(summary, function (o) {
      return o.teamName == g.team1;
    });
    var idx2 = _.findIndex(summary, function (o) {
      return o.teamName == g.team2;
    });
    if(g.forfeit) { //team1 is by default the winner of a forfeit
      summary[idx1].wins += 1;
      summary[idx2].losses += 1;
      summary[idx1].forfeits += 1;
      summary[idx2].forfeits += 1;
    }
    else { //not a forfeit
      if(g.score1 > g.score2) {
        summary[idx1].wins += 1;
        summary[idx2].losses += 1;
      }
      else if(g.score2 > g.score1) {
        summary[idx1].losses += 1;
        summary[idx2].wins += 1;
      }
      else { //it's a tie
        summary[idx1].ties += 1;
        summary[idx2].ties += 1;
      }
      summary[idx1].points += parseFloat(g.score1) - otPoints(g, 1);
      summary[idx2].points += parseFloat(g.score2) - otPoints(g, 2);
      summary[idx1].bHeard += bonusesHeard(g,1);
      summary[idx2].bHeard += bonusesHeard(g,2);
      summary[idx1].bPts += bonusPoints(g,1);
      summary[idx2].bPts += bonusPoints(g,2);
    }
  }
  return summary;
}



class MainInterface extends React.Component{

  constructor(props) {
    super(props);
    this.state = {
      tmWindowVisible: false,
      gmWindowVisible: false,
      orderBy: 'teamName',
      orderDir: 'asc',
      queryText: '',
      myTeams: [],
      myGames: [],
      activePane: 'teamsPane',  //either 'teamsPane' or 'gamesPane'
      forceResetForms: false,
      editWhichTeam: null,
      tmAddOrEdit: 'add', //either 'add' or 'edit'
      editWhichGame: null,
      gmAddOrEdit: 'add'
    };
    this.openTeamAddWindow = this.openTeamAddWindow.bind(this);
    this.openGameAddWindow = this.openGameAddWindow.bind(this);
    this.onModalClose = this.onModalClose.bind(this);
    this.onForceReset = this.onForceReset.bind(this);
    this.showAbout = this.showAbout.bind(this);
    this.addTeam = this.addTeam.bind(this);
    this.addGame = this.addGame.bind(this);
    this.modifyTeam = this.modifyTeam.bind(this);
    this.modifyGame = this.modifyGame.bind(this);
    this.deleteTeam = this.deleteTeam.bind(this);
    this.deleteGame = this.deleteGame.bind(this);
    this.openTeamForEdit = this.openTeamForEdit.bind(this);
    this.openGameForEdit = this.openGameForEdit.bind(this);
    this.onLoadTeamInModal = this.onLoadTeamInModal.bind(this);
    this.onLoadGameInModal = this.onLoadGameInModal.bind(this);
    this.validateTeamName = this.validateTeamName.bind(this);
    this.hasTeamPlayedInRound = this.hasTeamPlayedInRound.bind(this);
    this.reOrder = this.reOrder.bind(this);
    this.searchLists = this.searchLists.bind(this);
    this.setPane = this.setPane.bind(this);
  }

  componentDidMount() {
    ipc.on('addTeam', function(event,message) {
      this.openTeamAddWindow();
    }.bind(this));
    ipc.on('compileStatReport', function(event,message) {
      this.writeStatReport();
    }.bind(this));
    ipc.on('saveTournamentAs', function(event,fileName) {
      this.writeJSON(fileName);
    }.bind(this));
    ipc.on('openTournament', function(event,fileName) {
      this.loadTournament(fileName);
    }.bind(this));
  } //componentDidMount

  componentWillUnmount() {
    ipc.removeAllListeners('addTeam');
    ipc.removeAllListeners('compileStatReport');
    ipc.removeAllListeners('saveTournamentAs');
    ipc.removeAllListeners('openTournament');
  } //componentWillUnmount

  componentDidUpdate() {
    // fs.writeFile(teamDataLocation, JSON.stringify(this.state.myTeams), 'utf8', function(err) {
    //   if (err) { console.log(err); }
    // });//writeFile - teams
    // fs.writeFile(gameDataLocation, JSON.stringify(this.state.myGames), 'utf8', function(err) {
    //   if (err) { console.log(err); }
    // });//writeFile - games
  } //componentDidUpdate

  writeJSON(fileName) {
    var fileString = JSON.stringify(this.state.myTeams) + '\nDivider_between_teams_and_games\n' +
      JSON.stringify(this.state.myGames);
    fs.writeFile(fileName, fileString, 'utf8', function(err) {
      if (err) { console.log(err); }
    });
  }

  loadTournament(fileName) {
    currentFile = fileName[0]; //open dialog doesn't allow selecting multiple files
    var fileString = fs.readFileSync(currentFile, 'utf8');
    var [loadTeams, loadGames] = fileString.split('\nDivider_between_teams_and_games\n', 2);
    loadTeams = JSON.parse(loadTeams);
    loadGames = JSON.parse(loadGames);
    this.setState({
      myTeams: loadTeams,
      myGames: loadGames
    });
  }

  //compile data for the stat report and write it to each html file
  writeStatReport() {
    var standingsHtml = getStandingsHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(standingsLocation, standingsHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - standings
    var individualsHtml = getIndividualsHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(individualsLocation, individualsHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - individuals
    var scoreboardHtml = getScoreboardHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(scoreboardLocation, scoreboardHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - scoreboard
    var teamDetailHtml = getTeamDetailHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(teamDetailLocation, teamDetailHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - team detail
    var playerDetailHtml = getPlayerDetailHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(playerDetailLocation, playerDetailHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - individual Detail
    var roundReportHtml = getRoundReportHtml(this.state.myTeams, this.state.myGames);
    fs.writeFile(roundReportLocation, roundReportHtml, 'utf8', function(err) {
      if (err) { console.log(err); }
    });//writeFile - round report
  } //writeStatReport

  //called by buttons that open the team form
  openTeamAddWindow() {
    this.setState({
      tmWindowVisible: true
    });
  }

  //called by buttons that open the game form
  openGameAddWindow() {
    this.setState({
      gmWindowVisible: true
    });
  }

  //needed so the modals don't stay open on next render.
  //Also directs the modals to clear their data
  onModalClose() {
    this.setState({
      tmWindowVisible: false,
      gmWindowVisible: false,
      forceResetForms: true
    });
  }

  //make sure forms only reset data one time aftr they close
  onForceReset() {
    this.setState({
      forceResetForms: false,
      tmAddOrEdit: 'add',
      gmAddOrEdit: 'add'
    });
  }

  //TODO: delete??
  showAbout() {
    ipc.sendSync('openInfoWindow');
  } //showAbout

  //add the new team, then close the form
  addTeam(tempItem) {
    var tempTms = this.state.myTeams.slice();
    tempTms.push(tempItem);
    this.setState({
      myTeams: tempTms,
      tmWindowVisible: false
    }) //setState
  } //addTeam

  //add the new game, then close the form
  addGame(tempItem) {
    var tempGms = this.state.myGames.slice();
    tempGms.push(tempItem);
    this.setState({
      myGames: tempGms,
      gmWindowVisible: false
    }) //setState
  } //addTeam

  //update the appropriate team, close the form, and
  //update player names in game data if necessary
  //assumes whitespace has already been removed by TeamModal
  modifyTeam(oldTeam, newTeam) {
    var tempTeams = this.state.myTeams.slice();
    var oldTeamIdx = _.indexOf(tempTeams, oldTeam);
    tempTeams[oldTeamIdx] = newTeam;
    var tempGames = this.state.myGames.slice();

    // var playersRemoved = oldTeam.roster.length - newTeam.roster.length;
    // if(playersRemoved > 0) {
    //   this.removePlayers(tempGames, oldTeam.teamName, playersRemoved);
    // }
    for(var i in oldTeam.roster) {
      // if(i >= newTeam.roster.length) {
      //   //this.updatePlayerName(tempGames, oldTeam.teamName, i, '[Player deleted]');
      // }
      if(i < newTeam.roster.length && oldTeam.roster[i] != newTeam.roster[i]) {
        this.updatePlayerName(tempGames, oldTeam.teamName, oldTeam.roster[i], newTeam.roster[i]);
      }
    }

    if(oldTeam.teamName != newTeam.teamName) {
      this.updateTeamName(tempGames, oldTeam.teamName, newTeam.teamName);
    }

    this.setState({
      myTeams: tempTeams,
      myGames: tempGames,
      tmWindowVisible: false
    });
  }//modifyTeam

  //change the name of a given team for all games
  updateTeamName(gameAry, oldName, newName) {
    for(var i in gameAry){
      if(gameAry[i].team1 == oldName) {
        gameAry[i].team1 = newName;
      }
      if(gameAry[i].team2 == oldName) {
        gameAry[i].team2 = newName;
      }
    }
  }

  //change the name of a given player on a given team for all games
  updatePlayerName(gameAry, teamName, oldPlayerName, newPlayerName) {
    for(var i in gameAry) {
      if(teamName == gameAry[i].team1) {
        gameAry[i].players1[newPlayerName] = gameAry[i].players1[oldPlayerName];
        delete gameAry[i].players1[oldPlayerName];
      }
      else if(teamName == gameAry[i].team2) {
        gameAry[i].players2[newPlayerName] = gameAry[i].players2[oldPlayerName];
        delete gameAry[i].players2[oldPlayerName];
      }
    }
  }

  //remove the specified number of players from the specified team from each game
  // removePlayers(gameAry, teamName, numToRemove) {
  //   for(var i in gameAry) {
  //     if(teamName == gameAry[i].team1) {
  //       gameAry[i].players1.splice(gameAry[i].players1.length - numToRemove, numToRemove);
  //     }
  //     else if(teamName == gameAry[i].team2) {
  //       gameAry[i].players2.splice(gameAry[i].players2.length - numToRemove, numToRemove);
  //     }
  //   }
  // }

  //update the appropriate game, then close the form
  modifyGame(oldGame, newGame) {
    var tempGameAry = this.state.myGames.slice();
    var oldGameIdx = _.findIndex(tempGameAry, function (o) {
       return gameEqual(o, oldGame)
     });
    tempGameAry[oldGameIdx] = newGame;
    this.setState({
      myGames: tempGameAry,
      gmWindowVisible: false
    });
  }

  //permanently delete a team
  deleteTeam(item) {
    var allTeams = this.state.myTeams;
    var newTeams = _.without(allTeams, item);
    this.setState({
      myTeams: newTeams
    }); //setState
  } //deleteTeam

  //permanently delete a game
  deleteGame(item) {
    var allGames = this.state.myGames;
    var newGames = _.without(allGames, item);
    this.setState({
      myGames: newGames
    }); //setState
  } //deleteGame

  //tell the team window to load a team
  openTeamForEdit(item) {
    this.setState({
      editWhichTeam: item,
      tmAddOrEdit: 'edit'
    });
    this.openTeamAddWindow();
  }

  //tell the game window to load a game
  openGameForEdit(item) {
    this.setState({
      editWhichGame: item,
      gmAddOrEdit: 'edit'
    });
    this.openGameAddWindow();
  }

  //make sure the team form only loads the data once
  onLoadTeamInModal() {
    this.setState({
      editWhichTeam: null
    });
  }

  //make sure the game form only loads the data once
  onLoadGameInModal() {
    this.setState({
      editWhichGame: null
    });
  }

  //verify that the team name you've entered doesn't already belong
  //to another team. newTeamName is the form's value. savedTeam is the
  //existing team that was opened for edit
  //returns true or false
  validateTeamName(newTeamName, savedTeam) {
    var otherTeams;
    if(savedTeam != null) {
      otherTeams = _.without(this.state.myTeams, savedTeam);
    }
    else {
      otherTeams = this.state.myTeams;
    }
    var idx = _.findIndex(otherTeams, function(t) {
      return t.teamName.toLowerCase() == newTeamName.toLowerCase();
    });
    if(idx == -1) { return [true, '', '']; }
    else {
      return false;
     }
  }

  //has this team already played in this round? originalGameLoaded makes
  //sure that a game isn't counting itself as a repeat.
  hasTeamPlayedInRound(teamName, roundNo, originalGameLoaded) {
    for(var i in this.state.myGames) {
      var g = this.state.myGames[i];
      if(!gameEqual(g, originalGameLoaded) && g.round == roundNo &&
        (g.team1 == teamName || g.team2 == teamName)) {
        return true;
      }
    }
    return false;
  }

  reOrder(orderBy, orderDir) {
    this.setState({
      orderBy: orderBy,
      orderDir: orderDir
    }) //setState
  } //reOrder

  searchLists(query) {
    this.setState({
      queryText: query
    }); //setState
  } //searchLists

  setPane(pane) {
    this.setState({
      activePane: pane
    });
  } //setPane

  render() {
    var filteredTeams = [];
    var filteredGames = [];
    var queryText = this.state.queryText;
    var orderBy = this.state.orderBy;
    var orderDir = this.state.orderDir;
    var myTeams = this.state.myTeams;
    var myGames = this.state.myGames;
    var activePane = this.state.activePane;

    $(document).ready(function(){ $('.tooltipped').tooltip(); }); //initialize tooltips
    $('select').formSelect(); //initialize all dropdowns
    $('.fixed-action-btn').floatingActionButton(); //initialize floating buttons
    $('.modal').modal({
      onCloseEnd: this.onModalClose
    }); //initialize all modals
    if(this.state.tmWindowVisible === true) {
      $('#addTeam').modal('open');
    }
    if(this.state.gmWindowVisible === true) {
      $('#addGame').modal('open');
    }

    if (activePane == 'teamsPane') {
      filteredGames = myGames.slice(); // don't filter games
      //Filter list of teams
      for (var i = 0; i < myTeams.length; i++) {
        if (
          (myTeams[i].teamName.toLowerCase().indexOf(queryText)!=-1) ||
          (myTeams[i].roster.join(', ').toLowerCase().indexOf(queryText)!=-1)
        ) {
          filteredTeams.push(myTeams[i]);
        }
      }
      filteredTeams = _.orderBy(filteredTeams, function(item) {
        return item[orderBy].toLowerCase();
      }, orderDir); // order array
    }

    else if (activePane == 'gamesPane') {
      filteredTeams = myTeams.slice(); // don't filter teams
      //Filter list of games
      for (var i = 0; i < myGames.length; i++) {
        if (
          (myGames[i].team1.toLowerCase().indexOf(queryText)!=-1) ||
          (myGames[i].team2.toLowerCase().indexOf(queryText)!=-1)
        ) {
          filteredGames.push(myGames[i]);
        }
      }
      // don't sort games right now
      filteredGames = _.orderBy(filteredGames, function(item) {
        return item.round;
      }, 'asc'); // order array
    }

    //make a react element for each item in the lists
    filteredTeams=filteredTeams.map(function(item, index) {
      return(
        <TeamListEntry key = {index}
          singleItem = {item}
          whichItem =  {item}
          onDelete = {this.deleteTeam}
          onOpenTeam = {this.openTeamForEdit}
        />
      ) // return
    }.bind(this)); //filteredTeams.map
    filteredGames=filteredGames.map(function(item, index) {
      return(
        <GameListEntry key = {index}
          singleItem = {item}
          whichItem =  {item}
          onDelete = {this.deleteGame}
          onOpenGame = {this.openGameForEdit}
        />
      ) // return
    }.bind(this)); //filteredGames.map

    //need to make a deep copy of this object
    //to prevent player stats from updating before I tell them to
    var gameToLoadCopy = this.state.editWhichGame == null ? null : $.extend(true, {}, this.state.editWhichGame);

    return(
      <div className="application">
        <div className="interface">
          <AddTeamModal
            teamToLoad = {this.state.editWhichTeam}
            onLoadTeamInModal = {this.onLoadTeamInModal}
            addOrEdit = {this.state.tmAddOrEdit}
            addTeam = {this.addTeam}
            modifyTeam = {this.modifyTeam}
            forceReset = {this.state.forceResetForms}
            onForceReset = {this.onForceReset}
            isOpen = {this.state.tmWindowVisible}
            validateTeamName = {this.validateTeamName}
          />
          <AddGameModal
            gameToLoad = {gameToLoadCopy}
            onLoadGameInModal = {this.onLoadGameInModal}
            addOrEdit = {this.state.gmAddOrEdit}
            addGame = {this.addGame}
            modifyGame = {this.modifyGame}
            forceReset = {this.state.forceResetForms}
            onForceReset = {this.onForceReset}
            isOpen = {this.state.gmWindowVisible}
            teamData = {myTeams.slice()} //copy array to prevent unwanted state updates
            hasTeamPlayedInRound = {this.hasTeamPlayedInRound}
          />

          <div className="row">
            <div id="main-window" className="col s12 m12 l8">
              <HeaderNav
                orderBy = {this.state.orderBy}
                orderDir =  {this.state.orderDir}
                onReOrder = {this.reOrder}
                onSearch= {this.searchLists}
                setPane = {this.setPane}
                whichPaneActive = {activePane}
              />
              <TeamList
                whichPaneActive = {activePane}
                teamList = {filteredTeams}
                openModal = {this.openTeamAddWindow}
              />
              <GameList
                whichPaneActive = {activePane}
                gameList = {filteredGames}
                openModal = {this.openGameAddWindow}
              />
            </div>
            <div id="stat-sidebar" className="col l4 hide-on-med-and-down">
              <StatSidebar
                standings = {getSmallStandings(myTeams, myGames)}
              />
            </div>

          </div>
        </div>{/* interface */}
      </div>
    );
  } //render
};//MainInterface

ReactDOM.render(
  <MainInterface />,
  document.getElementById('statsInterface')
);
