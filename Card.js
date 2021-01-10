module.exports = class Card
{
    faceValue = -1;
    suit = -1;
    faceName = '';
    shortName = '';
    fullName = '';
    fullValue = -1;

    constructor(value, suit)
    {
        this.faceValue = (value + 1) > 10 ? 10 : (value + 1);
        this.fullValue = value + 1;
        this.suit = suit;
        this.faceName = this.getCardFaceName(value + 1);
        this.shortName = this.getCardShortName(value + 1);
        this.fullName = this.shortName + ' of ' + this.getCardSuit()
    }

    getCardFaceName(value)
    {
        if(value > 1 && value < 11)
        {
            return value.toString();
        }
        if(value == 1)
        {
            return 'A';
        }
        switch(value)
        {
            case 11:
                return 'J';
            case 12:
                return 'Q';
            case 13:
                return 'K';
        }
    }

    getCardShortName(value)
    {
        if(value > 1 && value < 11)
        {
            return value;
        }
        if(value == 1)
        {
            return 'Ace';
        }
        switch(value)
        {
            case 11:
                return 'Jack';
            case 12:
                return 'Queen';
            case 13:
                return 'King';
        }
    }

    getCardSuit()
    {
        switch(this.suit)
        {
            case 0:
                return 'Hearts';
            case 1:
                return 'Diamonds';
            case 2:
                return 'Clubs';
            case 3:
                return 'Spades';
        }
    }
}