// Nome da conta para os seletores (<select>), com a pessoa junto: "PicPay · PJ".
// Duas contas do mesmo banco, uma pessoal e uma da empresa, apareciam iguais na
// lista (10/11/2026, pedido do dono). Mesma regra do SeloPessoa: conta ligada a
// uma empresa é PJ; sem empresa é PF. Em <option> não cabe o selo, só texto.
export const nomeDaConta = (conta: { name: string; empresaId?: string | null }): string =>
  `${conta.name} · ${conta.empresaId ? 'PJ' : 'PF'}`;
