import pandas as pd
import unittest
from unittest.mock import patch

from coletores import coletar_fontes as c


class NormalizacaoTest(unittest.TestCase):
    @patch.object(c, "_municipios", return_value={"CUIABA": "5103403"})
    def test_rejeita_municipio_desconhecido(self, _):
        with self.assertRaisesRegex(ValueError, "sem correspondência"):
            c._por_nome(pd.DataFrame({"nome": ["Cidade inventada"], "v": [1]}), "nome", "v")

    @patch.object(c, "_municipios", return_value={"CUIABA": "5103403", "CACERES": "5102504"})
    def test_agrega_e_completa_zero_sem_estimar(self, _):
        entrada = pd.DataFrame({"nome": ["Cuiabá", "CUIABA"], "v": [2, 3]})
        self.assertEqual(c._por_nome(entrada, "nome", "v", preencher_zeros=True).to_dict("records"), [
            {"codigo_ibge": "5102504", "valor": 0.0},
            {"codigo_ibge": "5103403", "valor": 5.0},
        ])

    def test_chave_nome_tolera_acentos_e_pontuacao(self):
        self.assertEqual(c._chave_nome("São José do Xingu"), "SAOJOSEDOXINGU")


if __name__ == "__main__":
    unittest.main()
