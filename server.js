const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = 'secreta_pit2_grao_glace';

app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// --- MIDDLEWARE DE AUTH ---
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// --- AUTH (US001 / US002) ---
app.post('/api/auth/register', async (req, res) => {
  const { email, senha } = req.body || {};

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { email, senha: senhaHash }
    });
    return res.status(201).json({ id: usuario.id, email: usuario.email });
  } catch (e) {
    console.error('Erro no registro:', e);
    return res.status(400).json({ error: 'E-mail já cadastrado ou dados inválidos.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ userId: usuario.id }, JWT_SECRET, { expiresIn: '1d' });
  return res.json({ token, usuario: { id: usuario.id, email: usuario.email } });
});

// --- OPÇÕES / CATÁLOGO (US004) ---
app.get('/api/opcoes', async (req, res) => {
  const opcoes = await prisma.opcaoProduto.findMany({ where: { ativo: true } });
  return res.json(opcoes);
});

// Seeds para popular o catálogo rapidamente
app.post('/api/opcoes/seed', async (req, res) => {
  await prisma.opcaoProduto.createMany({
    data: [
      { nome: 'Massa Tradicional', tipo: 'MASSA', precoAdicional: 0.0 },
      { nome: 'Massa Red Velvet', tipo: 'MASSA', precoAdicional: 2.0 },
      { nome: 'Cobertura de Chocolate', tipo: 'COBERTURA', precoAdicional: 1.5 },
      { nome: 'Cobertura de Limão Siciliano', tipo: 'COBERTURA', precoAdicional: 1.5 },
      { nome: 'Cobertura de Leite Ninho', tipo: 'COBERTURA', precoAdicional: 2.0 }
    ]
  });
  return res.json({ message: 'Opções populadas com sucesso' });
});

// --- CRIAR PEDIDO / CARRINHO (US004, US006, US008) ---
app.post('/api/pedidos', authMiddleware, async (req, res) => {
  const { itens, cepEntrega } = req.body; // itens: [{ massaId, cobertura1Id, cobertura2Id, quantidade }]

  if (!itens || itens.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });

  // Validação: limite máximo de 50 itens por pedido
  const totalQuantidade = itens.reduce((acc, item) => acc + item.quantidade, 0);
  if (totalQuantidade > 50) {
    return res.status(400).json({ error: 'O pedido não pode exceder 50 cupcakes no total.' });
  }

  let valorTotalItens = 0;
  const itensParaCriar = [];

  for (const item of itens) {
    // Validação: no máximo 2 coberturas
    if (item.coberturas && item.coberturas.length > 2) {
      return res.status(400).json({ error: 'Máximo de 2 coberturas por cupcake.' });
    }

    const massa = await prisma.opcaoProduto.findUnique({ where: { id: item.massaId } });
    if (!massa || massa.tipo !== 'MASSA') {
      return res.status(400).json({ error: 'Massa inválida' });
    }

    let precoUnitario = 5.0 + massa.precoAdicional; // Preço base $5.00 + adicional da massa

    if (item.cobertura1Id) {
      const cob1 = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura1Id } });
      if (cob1) precoUnitario += cob1.precoAdicional;
    }

    if (item.cobertura2Id) {
      const cob2 = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura2Id } });
      if (cob2) precoUnitario += cob2.precoAdicional;
    }

    valorTotalItens += precoUnitario * item.quantidade;

    itensParaCriar.push({
      massaId: item.massaId,
      cobertura1Id: item.cobertura1Id || null,
      cobertura2Id: item.cobertura2Id || null,
      quantidade: item.quantidade,
      precoUnitario
    });
  }

  // Cálculo mock de frete baseado no CEP
  const valorFrete = cepEntrega ? 10.0 : 0.0;
  const valorFinal = valorTotalItens + valorFrete;

  const pedido = await prisma.pedido.create({
    data: {
      usuarioId: req.userId,
      cepEntrega,
      valorFrete,
      valorTotal: valorFinal,
      status: 'AGUARDANDO_PAGAMENTO',
      itens: { create: itensParaCriar }
    },
    include: { itens: true }
  });

  return res.status(201).json(pedido);
});

// --- GERAR PIX (US009) ---
app.post('/api/pedidos/:id/pix', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

  // Regra de negócio: Expirar PIX em 15 minutos
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000);

  // String EMV/BRCode mock simulando a chave Copia e Cola
  const codigoPix = `00020126580014br.gov.bcb.pix0136grao-glace-pix-key5204000053039865405${pedido.valorTotal.toFixed(2)}5802BR5910GRAO_GLACE6006MADRID62070503***6304E2CA`;

  const pagamento = await prisma.pagamento.upsert({
    where: { pedidoId: id },
    update: { codigoPix, expiraEm, status: 'PENDENTE' },
    create: {
      pedidoId: id,
      codigoPix,
      status: 'PENDENTE',
      expiraEm
    }
  });

  return res.json({
    pedidoId: pedido.id,
    valorTotal: pedido.valorTotal,
    metodo: 'PIX',
    codigoPix: pagamento.codigoPix,
    expiraEm: pagamento.expiraEm,
    status: pagamento.status
  });
});

app.listen(3000, () => console.log('🚀 Server rodando em http://localhost:3000'));