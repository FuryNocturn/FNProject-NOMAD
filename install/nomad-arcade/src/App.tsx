import { useEffect, useState } from 'react'
import { LANGUAGES, type Lang, useI18n } from './i18n'
import TicTacToe from './games/tictactoe/TicTacToe'
import Connect4 from './games/connect4/Connect4'
import Sudoku from './games/sudoku/Sudoku'
import Minesweeper from './games/minesweeper/Minesweeper'
import Solitaire from './games/solitaire/Solitaire'
import G2048 from './games/g2048/G2048'
import Reversi from './games/reversi/Reversi'
import Snake from './games/snake/Snake'
import Memory from './games/memory/Memory'
import WordSearch from './games/wordsearch/WordSearch'
import Chess from './games/chess/Chess'
import Checkers from './games/checkers/Checkers'
import Parchis from './games/parchis/Parchis'
import Domino from './games/domino/Domino'
import Poker from './games/poker/Poker'
import Blackjack from './games/blackjack/Blackjack'

const GAMES = [
  { id: 'tictactoe', icon: '⭕', Component: TicTacToe },
  { id: 'connect4', icon: '🔴', Component: Connect4 },
  { id: 'sudoku', icon: '🔢', Component: Sudoku },
  { id: 'minesweeper', icon: '💣', Component: Minesweeper },
  { id: 'solitaire', icon: '🃏', Component: Solitaire },
  { id: 'g2048', icon: '🧮', Component: G2048 },
  { id: 'reversi', icon: '⚫', Component: Reversi },
  { id: 'snake', icon: '🐍', Component: Snake },
  { id: 'memory', icon: '🧠', Component: Memory },
  { id: 'wordsearch', icon: '🔤', Component: WordSearch },
  { id: 'chess', icon: '♟️', Component: Chess },
  { id: 'checkers', icon: '⚪', Component: Checkers },
  { id: 'parchis', icon: '🎲', Component: Parchis },
  { id: 'domino', icon: '🔳', Component: Domino },
  { id: 'poker', icon: '♠️', Component: Poker },
  { id: 'blackjack', icon: '♥️', Component: Blackjack },
] as const

type GameId = (typeof GAMES)[number]['id']

/** Hash routing (#/sudoku), so the static site needs no server rewrites and the back button works. */
function useRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '')
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export default function App() {
  const { t, lang, setLang } = useI18n()
  const route = useRoute()
  const game = GAMES.find((g) => g.id === route)

  useEffect(() => {
    document.title = game ? `${t(`${game.id}.name` as `${GameId}.name`)} · NOMAD Arcade` : 'NOMAD Arcade'
  }, [game, t])

  if (game) return <game.Component />

  return (
    <main className="home">
      <header className="home-header">
        <div>
          <h1>NOMAD {t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <label className="lang">
          <span>{t('app.language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <ul className="game-grid">
        {GAMES.map((g) => (
          <li key={g.id}>
            <a className="game-card" href={`#/${g.id}`}>
              <span className="game-icon" aria-hidden="true">
                {g.icon}
              </span>
              <span className="game-name">{t(`${g.id}.name` as `${GameId}.name`)}</span>
              <span className="game-blurb">{t(`${g.id}.blurb` as `${GameId}.blurb`)}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
