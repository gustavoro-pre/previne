import openpyxl, sys, os
from openpyxl.drawing.image import Image as XImg
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
sys.path.insert(0, '/home/claude/chk'); from dados import CL, ORIGEM
NAVY='14213D'; BLUE='1F4E9C'; GRAY='6B7280'; RED='B91C1C'; LGRAY='F3F4F6'; LBLUE='E8EEF8'
EMP='PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA'; CNPJ='CNPJ 03.052.261/0001-43'
HOJE='28/11/2026'; ELAB='Gustavo Rogel de Almeida'; VERIF='Thiago Rogel de Almeida'; APROV='Claudio José de Almeida'
fino=Side(style='thin',color='9CA3AF'); B=Border(left=fino,right=fino,top=fino,bottom=fino)
def F(**k): k.setdefault('name','Arial'); k.setdefault('size',9); return Font(**k)
NDIAS=31; C0=4; CF=C0+NDIAS-1  # colunas D..AH = dias
def caixa(ws,r1,c1,r2,c2,txt='',font=None,fill=None,al=None):
    if (r1,c1)!=(r2,c2): ws.merge_cells(start_row=r1,start_column=c1,end_row=r2,end_column=c2)
    c=ws.cell(r1,c1,txt); c.font=font or F(); c.alignment=al or Alignment(vertical='center',wrap_text=True)
    for r in range(r1,r2+1):
        for cc in range(c1,c2+1):
            x=ws.cell(r,cc); x.border=B
            if fill: x.fill=PatternFill('solid',fgColor=fill)
    return c
def gerar(d, dst):
    code='FOR-SST-%03d'%d['n']; rev='000'
    wb=openpyxl.Workbook(); ws=wb.active; ws.title='Checklist'
    ws.column_dimensions['A'].width=8; ws.column_dimensions['B'].width=58; ws.column_dimensions['C'].width=5.5
    for c in range(C0,CF+1): ws.column_dimensions[L(c)].width=3.1
    # cabeçalho padrão
    for r,h in zip(range(1,6),(20,22,24,16,16)): ws.row_dimensions[r].height=h
    caixa(ws,1,1,5,1); img=XImg('/home/claude/ipar/logo.png'); img.width,img.height=50,44; ws.add_image(img,'A1')
    ws.merge_cells('A1:A5')
    caixa(ws,1,2,1,2,EMP,F(bold=True,size=10,color=NAVY)); caixa(ws,2,2,3,2,'CHECKLIST DE INSPEÇÃO PRÉ-USO' if d['n']!=129 and d['n']!=127 else ('INSPEÇÃO 5S' if d['n']==129 else 'CHECKLIST DE LIBERAÇÃO'),F(bold=True,size=9,color=GRAY))
    ws.cell(2,2).value=(ws.cell(2,2).value+'\n'+d['t'].upper()); ws.cell(2,2).font=F(bold=True,size=12,color=BLUE)
    caixa(ws,4,2,5,2,'Referência: '+d['ref']+'   ·   Frequência: '+d.get('freq','antes do uso, a cada turno em que for usado'),F(size=8,color=GRAY))
    lab=[('Código',code),('Revisão',rev+' – '+HOJE),('Elaborado por',ELAB),('Verificado por',VERIF),('Aprovado por',APROV)]
    for i,(a,b) in enumerate(lab):
        caixa(ws,1+i,3,1+i,C0+5,a,F(size=7,color=GRAY)); caixa(ws,1+i,C0+6,1+i,CF,b,F(bold=True,size=8))
    # identificação
    r=7
    campos=['Unidade: (  ) Barra Mansa   (  ) Resende   ·   Área/local: ____________________________   ·   Mês/ano: ____/______',
            'Equipamento/TAG: ____________________   ·   Marca/modelo: ____________________   ·   Responsável pelo equipamento: ____________________']+d.get('campos',[])
    for c in campos: caixa(ws,r,1,r,CF,c,F(size=9)); ws.row_dimensions[r].height=17; r+=1
    caixa(ws,r,1,r,CF,'Preencha por dia de uso:  C = conforme   ·   NC = não conforme   ·   NA = não se aplica.   ● na coluna IMP. = item impeditivo: se NC, o equipamento NÃO pode ser usado.',F(size=8,bold=True,color=NAVY),LBLUE); ws.row_dimensions[r].height=24; r+=1
    # títulos da tabela
    caixa(ws,r,1,r,1,'Nº',F(bold=True,size=8,color='FFFFFF'),BLUE,Alignment(horizontal='center',vertical='center'))
    caixa(ws,r,2,r,2,'ITEM DE VERIFICAÇÃO',F(bold=True,size=8,color='FFFFFF'),BLUE)
    caixa(ws,r,3,r,3,'IMP.',F(bold=True,size=7,color='FFFFFF'),BLUE,Alignment(horizontal='center',vertical='center'))
    for i in range(NDIAS): caixa(ws,r,C0+i,r,C0+i,str(i+1),F(bold=True,size=7,color='FFFFFF'),BLUE,Alignment(horizontal='center',vertical='center'))
    thead=r; r+=1; n=0; ini=r
    for grupo,itens in d['g']:
        caixa(ws,r,1,r,CF,grupo.upper(),F(bold=True,size=8,color=NAVY),LGRAY); ws.row_dimensions[r].height=14; r+=1
        for txt,imp in itens:
            n+=1; caixa(ws,r,1,r,1,n,F(size=8),None,Alignment(horizontal='center',vertical='center'))
            caixa(ws,r,2,r,2,txt,F(size=8)); caixa(ws,r,3,r,3,'●' if imp else '',F(size=9,bold=True,color=RED),None,Alignment(horizontal='center',vertical='center'))
            for c in range(C0,CF+1): caixa(ws,r,c,r,c,'',F(size=7),None,Alignment(horizontal='center',vertical='center'))
            ws.row_dimensions[r].height=23 if len(txt)>78 else 13.5; r+=1
    fim=r-1
    dv=DataValidation(type='list',formula1='"C,NC,NA"',allow_blank=True,showErrorMessage=False); dv.add('%s%d:%s%d'%(L(C0),ini,L(CF),fim)); ws.add_data_validation(dv)
    for txt in ('Rubrica de quem inspecionou','Visto da liderança (semanal)'):
        caixa(ws,r,1,r,3,txt,F(bold=True,size=8)); [caixa(ws,r,c,r,c) for c in range(C0,CF+1)]; ws.row_dimensions[r].height=20; r+=1
    r+=1
    caixa(ws,r,1,r,CF,'SE ALGUM ITEM FICAR NC: ● impeditivo → não use; retire de uso, coloque a etiqueta "NÃO USE – EM MANUTENÇÃO", avise a liderança e registre em DDS e inspeções › Inspeções (portal). Item sem ● → registre abaixo e corrija o quanto antes. Só volte a usar depois da correção e de nova inspeção.',F(size=8,bold=True,color=RED),'FEF2F2'); ws.row_dimensions[r].height=34; r+=1
    caixa(ws,r,1,r,1,'Dia',F(bold=True,size=8),LGRAY); caixa(ws,r,2,r,2,'Não conformidade / observação',F(bold=True,size=8),LGRAY); caixa(ws,r,3,r,C0+13,'Ação tomada',F(bold=True,size=8),LGRAY); caixa(ws,r,C0+14,r,C0+23,'Responsável',F(bold=True,size=8),LGRAY); caixa(ws,r,C0+24,r,CF,'Liberado em',F(bold=True,size=8),LGRAY); r+=1
    for _ in range(4):
        caixa(ws,r,1,r,1); caixa(ws,r,2,r,2); caixa(ws,r,3,r,C0+13); caixa(ws,r,C0+14,r,C0+23); caixa(ws,r,C0+24,r,CF); ws.row_dimensions[r].height=18; r+=1
    r+=1
    caixa(ws,r,1,r,CF,'Declaro que as informações desta lista são verdadeiras.      Inspecionado por: ______________________________   Matrícula: __________   Assinatura: ____________________',F(size=8))
    ws.row_dimensions[r].height=20
    # impressão
    ws.page_setup.orientation='landscape'; ws.page_setup.paperSize=9; ws.page_setup.fitToWidth=1; ws.page_setup.fitToHeight=1; ws.sheet_properties.pageSetUpPr.fitToPage=True
    ws.page_margins.left=ws.page_margins.right=0.3; ws.page_margins.top=0.35; ws.page_margins.bottom=0.45
    ws.print_title_rows='%d:%d'%(thead,thead); ws.print_area='A1:%s%d'%(L(CF),r)
    ws.oddFooter.left.text=EMP+' – '+CNPJ; ws.oddFooter.left.size=7
    ws.oddFooter.center.text=code+' · Rev. '+rev; ws.oddFooter.center.size=7
    ws.oddFooter.right.text='Página &P de &N'; ws.oddFooter.right.size=7
    ws.sheet_view.showGridLines=False; ws.freeze_panes='D%d'%(thead+1)
    # controle de revisões
    R=wb.create_sheet('Controle de revisões')
    R['A1']=EMP+' · '+CNPJ; R['A1'].font=F(bold=True,color=NAVY,size=11)
    R['A2']=code+' · '+d['t']; R['A2'].font=F(bold=True,color=BLUE,size=11)
    R.append([]); R.append(['Revisão','Data','O que foi alterado'])
    for c in R[4]: c.font=F(bold=True,color='FFFFFF'); c.fill=PatternFill('solid',fgColor=BLUE)
    R.append([rev,HOJE,'Emissão no padrão Previne, a partir do(s) checklist(s) antigo(s): %s. Itens revisados e agrupados, item impeditivo marcado, referências às NRs, regra para NC e registro no portal.'%ORIGEM.get(d['n'],'—')])
    R.column_dimensions['A'].width=10; R.column_dimensions['B'].width=12; R.column_dimensions['C'].width=120
    R['C5'].alignment=Alignment(wrap_text=True)
    wb.save(dst); return code, n, sum(1 for g in d['g'] for t,i in g[1] if i)
if __name__=='__main__':
    import re, unicodedata
    out='/home/claude/chk/out'; os.makedirs(out,exist_ok=True)
    res=[]
    for d in CL:
        nome=unicodedata.normalize('NFKD',d['t']).encode('ascii','ignore').decode(); nome=re.sub(r'[^A-Za-z0-9]+',' ',nome).strip().upper()
        fn='%s/FOR-SST-%03d - CHECKLIST %s - Rev000.xlsx'%(out,d['n'],nome[:60])
        res.append((gerar(d,fn),d['t'],fn))
    for (code,n,imp),t,fn in res: print(code,n,'itens',imp,'impeditivos','|',t)
