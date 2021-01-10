const Card = require("./Card");

module.exports = class Deck
{
    disposedCards = [];
    cards = [];

    constructor()
    {
        this.buildDeck();
        this.shuffleDeck();
    }

    buildDeck()
    {
        this.cards = [];
        for(let i = 0; i < 13; i++)
        {
            for(let j = 0; j < 4; j++)
            {
                this.cards.push(new Card(i, j));
            }
        }
    }

    shuffleDeck()
    {
        for(let i = this.cards.length - 1; i >= 0; i--)
        {
            var rnd = Math.floor(Math.random() * 51);
            let nextCard = this.cards[rnd];
            this.cards[rnd] = this.cards[i];
            this.cards[i] = nextCard;
        }
    }

    dealCard()
    {
        if(this.disposedCards.length == 52)
        {
            return null;
        }

        let card = this.cards.shift();
        this.disposedCards.push(card);
        return card;
    }
}