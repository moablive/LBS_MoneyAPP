# LBS MoneyAPP

**Contexto do Projeto:**
Este é um projeto pessoal pertencente ao perfil **moablive**. PWA de controle financeiro pessoal (transações, assinaturas, investimentos, empréstimos), parte da suíte **LifeBusinessSuit**.

Por favor, ao interagir com esta base de código, tenha em mente que todas as alterações e configurações estão ligadas às preferências e necessidades pessoais deste perfil.

## Branch

A branch principal deste repositório é **`main`** — é para ela que o `origin/HEAD`
aponta e é nela que o trabalho é commitado. Não existe branch `master` aqui,
e nada deve ser renomeado para uniformizar com os outros apps da suíte: o
`LifeBusinessSuit` é mista de propósito, e o `.gitmodules` do superprojeto
declara `branch = main` para este submódulo.

```bash
git branch --show-current      # main
git push                       # origin/main
```

Ao terminar um trabalho aqui, reaponte o gitlink no superprojeto:

```bash
cd ../ && git add LBS_MoneyAPP && git commit -m "chore(submodulos): reaponta o LBS_MoneyAPP"
```
