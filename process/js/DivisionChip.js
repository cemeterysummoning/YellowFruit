var React = require('react');
const chipColors = ['yellow', 'light-green', 'orange', 'light-blue',
  'red', 'purple', 'teal', 'deep-purple'];

class DivisionChip extends React.Component{

  constructor(props) {
    super(props);
    this.removeDivision = this.removeDivision.bind(this);
  }

  removeDivision() {
    this.props.removeDivision(this.props.phase);
  }

  render() {
    return (
      <div className="chip-wrapper">
        <div className={'chip accent-1 ' + chipColors[this.props.colorNo % chipColors.length]}>
          {this.props.division}
          <i className="close material-icons" onClick={this.removeDivision}>close</i>
        </div>
      </div>
    );
  }

}

module.exports = DivisionChip;
