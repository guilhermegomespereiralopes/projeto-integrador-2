-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OpcaoProduto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "precoAdicional" REAL NOT NULL DEFAULT 0.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CARRINHO',
    "cepEntrega" TEXT,
    "valorFrete" REAL NOT NULL DEFAULT 0.0,
    "valorTotal" REAL NOT NULL DEFAULT 0.0,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'CUPCAKE',
    "massaId" TEXT,
    "cobertura1Id" TEXT,
    "cobertura2Id" TEXT,
    "cafeId" TEXT,
    "tamanhoId" TEXT,
    "adicional1Id" TEXT,
    "adicional2Id" TEXT,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" REAL NOT NULL,
    CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_massaId_fkey" FOREIGN KEY ("massaId") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_cobertura1Id_fkey" FOREIGN KEY ("cobertura1Id") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_cobertura2Id_fkey" FOREIGN KEY ("cobertura2Id") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_tamanhoId_fkey" FOREIGN KEY ("tamanhoId") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_adicional1Id_fkey" FOREIGN KEY ("adicional1Id") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_adicional2Id_fkey" FOREIGN KEY ("adicional2Id") REFERENCES "OpcaoProduto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'PIX',
    "codigoPix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "expiraEm" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_pedidoId_key" ON "Pagamento"("pedidoId");
