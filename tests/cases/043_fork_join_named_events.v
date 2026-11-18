module tb;
  event step;
  integer count, first, second;
  initial begin
    count = 0;
    first = 0;
    second = 0;
    fork
      begin
        @step;
        count = count + 1;
        @step;
        count = count + 1;
      end
      begin
        #2 first = 12;
        -> step;
        #3 second = 34;
        -> step;
      end
      begin
        #4 $display("inside first=%0d second=%0d count=%0d", first, second, count);
      end
    join
    #1 $display("joined first=%0d second=%0d count=%0d time=%0d", first, second, count, $time);
    $finish;
  end
endmodule