# commerce-front

[commerce](https://github.com/Wootae01/commerce) 백엔드의 사용자 화면(React).

## 기술 스택

- React 19 + TypeScript + Vite
- React Router, TanStack Query
- Tailwind CSS
- Vitest + React Testing Library + MSW

## 로컬 실행

백엔드를 `http://localhost:8080`에 띄운 뒤:

```bash
npm install
npm run dev   # http://localhost:5173
```

Vite 개발 서버가 `/api`, `/oauth2`, `/login/oauth2`, `/logout`, `/uploads`, `/images`를 백엔드로 넘긴다. 배포 사이트와 같은 출처로 보이게 하려는 것으로, 이유는 백엔드 `docs/adr/0001-react-owns-user-screen-urls.md`에 있다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 빌드 |
| `npm run lint` | oxlint |
| `npm test` / `npm run test:run` | 테스트 (watch / 1회) |

## 용어

화면 문구와 코드 이름은 백엔드 [`GLOSSARY.md`](https://github.com/Wootae01/commerce/blob/dev/GLOSSARY.md)를 따른다.
