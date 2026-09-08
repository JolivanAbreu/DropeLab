export default function SizeGuide() {
  return (
    <div className="mx-auto max-w-3xl px-2.5 py-4 sm:px-4">
      <div className="rounded-lg bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)] sm:p-8">
        <h1 className="text-[22px] font-black uppercase text-[#111111]">Guia de Medidas</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Nossas peças são oversized de propósito — o caimento é solto e mais largo que o tamanho "normal" que você
          costuma vestir. Se você gosta de um caimento ainda mais largo, considere subir um tamanho.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left font-mono text-xs uppercase text-ink-soft">
                <th className="py-2.5 pr-3">Tamanho</th>
                <th className="py-2.5 pr-3">Largura do busto (cm)</th>
                <th className="py-2.5 pr-3">Comprimento (cm)</th>
                <th className="py-2.5">Ombro a ombro (cm)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['P', '58', '70', '58'],
                ['M', '61', '72', '61'],
                ['G', '64', '74', '64'],
                ['GG', '67', '76', '67'],
                ['XG', '70', '78', '70'],
              ].map(([size, chest, length, shoulder]) => (
                <tr key={size} className="border-b border-line">
                  <td className="py-2.5 pr-3 font-black">{size}</td>
                  <td className="py-2.5 pr-3">{chest}</td>
                  <td className="py-2.5 pr-3">{length}</td>
                  <td className="py-2.5">{shoulder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase text-[#111111]">Largura do busto</p>
            <p className="mt-1.5 text-xs text-ink-soft">
              Meça de uma axila à outra, com a peça esticada sobre uma superfície plana, de ponta a ponta.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#111111]">Comprimento</p>
            <p className="mt-1.5 text-xs text-ink-soft">
              Meça do ponto mais alto do ombro (na gola) até a barra da peça.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#111111]">Ombro a ombro</p>
            <p className="mt-1.5 text-xs text-ink-soft">
              Meça a distância reta entre as costuras dos dois ombros, na parte de trás da peça.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-md border border-dashed border-line bg-canvas p-4">
          <p className="text-xs font-black uppercase text-[#111111]">Dica</p>
          <p className="mt-1.5 text-xs text-ink-soft">
            Pegue uma peça oversized que você já tenha em casa e goste do caimento, meça ela do jeito acima, e compare
            com a tabela — é o jeito mais confiável de escolher o tamanho certo sem provar a peça antes.
          </p>
        </div>
      </div>
    </div>
  );
}
